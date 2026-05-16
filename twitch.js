require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers] 
});

const TWITCH_USERNAME = 'officialmrhungry';
let DISCORD_CHANNEL_ID = null;
let isLive = false;

// Store birthdays { userId: { date: "MM-DD", year: "YYYY", name: "username" } }
let birthdays = new Map();
let stickyMessageId = null;
let stickyChannelId = null;

const commands = [
    new SlashCommandBuilder().setName('active').setDescription('Check if the bot is active and online'),
    new SlashCommandBuilder().setName('test').setDescription('Test if the bot is working'),
    new SlashCommandBuilder().setName('ask')
        .setDescription('Ask the bot anything')
        .addStringOption(option => option.setName('question').setDescription('Your question').setRequired(true)),
    new SlashCommandBuilder().setName('rules').setDescription('Display server rules'),
    new SlashCommandBuilder().setName('say')
        .setDescription('Make the bot say something (Admin only)')
        .addStringOption(option => option.setName('message').setDescription('What you want the bot to say').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('testlive').setDescription('Test the live announcement message').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('setchannel').setDescription('Set notification channel').addChannelOption(option => option.setName('channel').setDescription('The channel').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('setbirthdaychannel')
        .setDescription('Set channel for birthday sticky message (Admin only)')
        .addChannelOption(option => option.setName('channel').setDescription('The channel for birthday messages').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    // MODERATION COMMANDS
    new SlashCommandBuilder().setName('timeout')
        .setDescription('Timeout a member')
        .addUserOption(option => option.setName('user').setDescription('User to timeout').setRequired(true))
        .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for timeout').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    new SlashCommandBuilder().setName('warn')
        .setDescription('Warn a member')
        .addUserOption(option => option.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for warning').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    
    new SlashCommandBuilder().setName('kick')
        .setDescription('Kick a member')
        .addUserOption(option => option.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for kick').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    
    new SlashCommandBuilder().setName('ban')
        .setDescription('Ban a member')
        .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for ban').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    new SlashCommandBuilder().setName('clear')
        .setDescription('Clear messages in a channel')
        .addIntegerOption(option => option.setName('amount').setDescription('Number of messages to clear (1-100)').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    new SlashCommandBuilder().setName('announce')
        .setDescription('Make an announcement (Admin only)')
        .addStringOption(option => option.setName('message').setDescription('Announcement message').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('Channel to announce in').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    // FUN COMMANDS
    new SlashCommandBuilder().setName('calc').setDescription('Solve any math problem').addStringOption(option => option.setName('math').setDescription('Math problem like 2+2').setRequired(true)),
    new SlashCommandBuilder().setName('roll').setDescription('Roll dice').addIntegerOption(option => option.setName('sides').setDescription('Number of sides (default 6)')).addIntegerOption(option => option.setName('count').setDescription('Number of dice (default 1)')),
    new SlashCommandBuilder().setName('random').setDescription('Random number between min and max').addIntegerOption(option => option.setName('min').setDescription('Minimum').setRequired(true)).addIntegerOption(option => option.setName('max').setDescription('Maximum').setRequired(true)),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball a question').addStringOption(option => option.setName('question').setDescription('Your question').setRequired(true)),
    new SlashCommandBuilder().setName('cat').setDescription('Get a random cat picture'),
    new SlashCommandBuilder().setName('dog').setDescription('Get a random dog picture'),
    new SlashCommandBuilder().setName('fact').setDescription('Get a random interesting fact'),
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('avatar').setDescription('Get a users avatar').addUserOption(option => option.setName('user').setDescription('The user').setRequired(false)),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Get information about this server'),
    new SlashCommandBuilder().setName('userinfo').setDescription('Get information about a user').addUserOption(option => option.setName('user').setDescription('The user').setRequired(false))
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

let warnings = new Map();

async function sendAnnouncement() {
    if (!DISCORD_CHANNEL_ID) return;
    const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
    if (!channel) return;
    const message = `@📢┃Streams **MR HUNGRY LIVE RIGHT NOW GUYSSS!!** TUNE IN DOWN BELOW 👇\nhttps://www.twitch.tv/officialmrhungry`;
    await channel.send(message);
}

async function checkStream() {
    if (!DISCORD_CHANNEL_ID) return;
    try {
        const response = await axios.get(`https://decapi.me/twitch/uptime/${TWITCH_USERNAME}`);
        const currentlyLive = !response.data.includes('offline');
        if (currentlyLive && !isLive) {
            isLive = true;
            await sendAnnouncement();
        } else if (!currentlyLive && isLive) {
            isLive = false;
        }
    } catch(e) {}
}

async function getAIResponse(question) {
    const q = question.toLowerCase();
    if (q.includes('hello') || q.includes('hi')) return `Hello there! 👋`;
    if (q.includes('how are you')) return `I'm doing great! 🤖`;
    if (q.includes('your name')) return `I'm HUNGRY.BOT! 🎮`;
    if (q.includes('what can you do')) return `Commands: /ask, /rules, /timeout, /warn, /kick, /ban, /clear, /announce, /cat, /dog, /roll, /8ball, /random, /calc, /ping`;
    if (q.includes('?')) {
        const yesNo = ['Yes!', 'No.', 'Probably.', 'Definitely not.', 'Maybe?', 'Of course!', 'I doubt it.', 'For sure!'];
        return yesNo[Math.floor(Math.random() * yesNo.length)];
    }
    return `That's interesting! Tell me more about "${question.substring(0, 30)}..."`;
}

async function updateStickyBirthdayMessage() {
    if (!stickyChannelId) return;
    
    const channel = client.channels.cache.get(stickyChannelId);
    if (!channel) return;
    
    // Count birthdays by month
    const monthCount = new Map();
    for (const [_, data] of birthdays) {
        const month = data.date.split('-')[0];
        monthCount.set(month, (monthCount.get(month) || 0) + 1);
    }
    
    const embed = new EmbedBuilder()
        .setColor(0xFF69B4)
        .setTitle('🎂 SERVER BIRTHDAYS 🎂')
        .setDescription('Click the button below to set or update your birthday!')
        .addFields(
            { name: '📊 Statistics', value: `${birthdays.size} members have set their birthdays!`, inline: false },
            { name: '🎁 How it works', value: '• Click "Set Birthday"\n• Enter MM/DD/YYYY\n• Bot announces on your special day\n• Get a special birthday message!', inline: false }
        )
        .setFooter({ text: 'Your birthday is only shown on the actual day!' })
        .setTimestamp();
    
    // Add birthday list if there are birthdays
    if (birthdays.size > 0) {
        let birthdayList = '';
        for (const [userId, data] of birthdays) {
            const user = await client.users.fetch(userId).catch(() => null);
            if (user) {
                birthdayList += `**${user.username}** - ${data.date}\n`;
            }
        }
        if (birthdayList.length > 0) {
            embed.addFields({ name: '📅 Current Birthdays', value: birthdayList.substring(0, 1024), inline: false });
        }
    }
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('set_birthday')
                .setLabel('🎂 Set My Birthday')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('view_birthdays')
                .setLabel('📅 View Birthdays')
                .setStyle(ButtonStyle.Secondary)
        );
    
    if (stickyMessageId) {
        try {
            const oldMessage = await channel.messages.fetch(stickyMessageId);
            await oldMessage.edit({ embeds: [embed], components: [row] });
        } catch {
            const newMessage = await channel.send({ embeds: [embed], components: [row] });
            stickyMessageId = newMessage.id;
        }
    } else {
        const newMessage = await channel.send({ embeds: [embed], components: [row] });
        stickyMessageId = newMessage.id;
    }
}

async function checkBirthdays() {
    const today = new Date();
    const todayStr = `${today.getMonth() + 1}-${today.getDate()}`;
    const currentYear = today.getFullYear();
    
    for (const [userId, data] of birthdays) {
        if (data.date === todayStr) {
            // Check if already announced this year
            if (data.lastAnnounced === currentYear) continue;
            
            const user = await client.users.fetch(userId).catch(() => null);
            if (user) {
                const channel = stickyChannelId ? client.channels.cache.get(stickyChannelId) : client.channels.cache.find(ch => ch.name === 'general');
                if (channel) {
                    const age = data.year ? currentYear - parseInt(data.year) : null;
                    
                    const birthdayEmbed = new EmbedBuilder()
                        .setColor(0xFF69B4)
                        .setTitle('🎉🎂 HAPPY BIRTHDAY! 🎂🎉')
                        .setDescription(`🎈 **${user.username}** is celebrating their birthday today! 🎈`)
                        .addFields(
                            { name: '🥳 Wishes', value: `Everyone wish **${user.username}** a fantastic day! 🎁🎊`, inline: false },
                            { name: '🎂 Celebration', value: age ? `Turning ${age} years old!` : `Another year around the sun!`, inline: true }
                        )
                        .setImage('https://media.tenor.com/McNlt8oS5WkAAAAi/happy-birthday-cake.gif')
                        .setFooter({ text: `Happy Birthday ${user.username}! 🎉` })
                        .setTimestamp();
                    
                    await channel.send({ content: `🎉 @everyone 🎉`, embeds: [birthdayEmbed] });
                    
                    // Mark as announced this year
                    data.lastAnnounced = currentYear;
                    birthdays.set(userId, data);
                }
            }
        }
    }
    await updateStickyBirthdayMessage();
}

client.on('ready', async () => {
    console.log(`${client.user.tag} is online!`);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(cmd => cmd.toJSON()) });
    console.log('Commands registered!');
    setInterval(checkStream, 60000);
    setInterval(checkBirthdays, 3600000); // Check every hour
    await updateStickyBirthdayMessage();
});

client.on('interactionCreate', async (interaction) => {
    // Handle BUTTONS (for birthday system)
    if (interaction.isButton()) {
        if (interaction.customId === 'set_birthday') {
            const modal = new ModalBuilder()
                .setCustomId('birthday_modal')
                .setTitle('🎂 Set Your Birthday 🎂');
            
            const dateInput = new TextInputBuilder()
                .setCustomId('birthday_date')
                .setLabel('Your Birthday (MM/DD/YYYY)')
                .setPlaceholder('Example: 05/16/2000')
                .setRequired(true)
                .setStyle(TextInputStyle.Short);
            
            const actionRow = new ActionRowBuilder().addComponents(dateInput);
            modal.addComponents(actionRow);
            
            await interaction.showModal(modal);
        }
        
        if (interaction.customId === 'view_birthdays') {
            if (birthdays.size === 0) {
                return interaction.reply({ content: 'No birthdays set yet! Click "Set My Birthday" to add yours!', ephemeral: true });
            }
            
            let birthdayList = '';
            for (const [userId, data] of birthdays) {
                const user = await client.users.fetch(userId).catch(() => null);
                if (user) {
                    birthdayList += `**${user.username}** - ${data.date}\n`;
                }
            }
            
            const embed = new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle('📅 Server Birthdays')
                .setDescription(birthdayList || 'No birthdays yet')
                .setFooter({ text: `${birthdays.size} birthdays total` });
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (interaction.customId === 'agree_rules') {
            await interaction.reply({ content: '✅ Thank you for agreeing to the rules!', ephemeral: true });
        }
        return;
    }
    
    // Handle MODAL submission (birthday form)
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'birthday_modal') {
            const birthdayInput = interaction.fields.getTextInputValue('birthday_date');
            
            // Parse MM/DD/YYYY
            const parts = birthdayInput.split('/');
            if (parts.length !== 3) {
                return interaction.reply({ content: '❌ Please use format: MM/DD/YYYY (e.g., 05/16/2000)', ephemeral: true });
            }
            
            const month = parseInt(parts[0]);
            const day = parseInt(parts[1]);
            const year = parts[2];
            
            if (month < 1 || month > 12 || day < 1 || day > 31) {
                return interaction.reply({ content: '❌ Invalid date! Please use valid month (1-12) and day (1-31)', ephemeral: true });
            }
            
            const dateStr = `${month}-${day}`;
            
            birthdays.set(interaction.user.id, {
                date: dateStr,
                year: year,
                name: interaction.user.username,
                lastAnnounced: null
            });
            
            await updateStickyBirthdayMessage();
            
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Birthday Saved! 🎂')
                .setDescription(`Your birthday (${birthdayInput}) has been saved!`)
                .addFields(
                    { name: '🎉 What happens next?', value: `On your birthday, the bot will announce it and everyone will celebrate with you!`, inline: false }
                )
                .setFooter({ text: 'We\'ll remember your special day!' });
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        return;
    }
    
    if (!interaction.isCommand()) return;
    
    // COMMAND HANDLERS
    if (interaction.commandName === 'active') {
        await interaction.reply('✅ Bot is ACTIVE and ONLINE! 🎮');
    }
    
    if (interaction.commandName === 'test') {
        await interaction.reply('✅ Bot is online!');
    }
    
    if (interaction.commandName === 'ask') {
        const question = interaction.options.getString('question');
        await interaction.deferReply();
        const answer = await getAIResponse(question);
        await interaction.editReply(`🤖 **You asked:** ${question}\n\n**Answer:** ${answer}`);
    }
    
    if (interaction.commandName === 'setbirthdaychannel') {
        const channel = interaction.options.getChannel('channel');
        stickyChannelId = channel.id;
        await updateStickyBirthdayMessage();
        await interaction.reply(`✅ Birthday sticky message will now appear in ${channel}!`);
    }
    
    if (interaction.commandName === 'rules') {
        const rulesMessage = `**📜 SERVER RULES**\n\n` +
            `1️⃣ Respect everyone. Toxicity, harassment, racism, or hate is not allowed.\n` +
            `2️⃣ No spamming, flooding, or excessive caps.\n` +
            `3️⃣ No NSFW content or promotion of such content.\n` +
            `4️⃣ No gore or disturbing content.\n` +
            `5️⃣ No advertising without staff permission.\n` +
            `6️⃣ No scams, phishing, or fake links.\n` +
            `7️⃣ Do not leak personal information or DMs.\n` +
            `8️⃣ Use channels correctly.\n` +
            `9️⃣ No trolling or intentionally causing drama.\n` +
            `🔟 No mic spam, earrape, or soundboards abuse in VC.\n` +
            `1️⃣1️⃣ Do not ping moderator roles without appropriate action needing to be taken.\n` +
            `1️⃣2️⃣ Staff decisions must be respected.\n` +
            `1️⃣3️⃣ Follow Discord ToS at all times.\n\n` +
            `**⚠️ PUNISHMENTS**\n\n` +
            `3 warnings within 2 weeks: 1 week timeout/ban.\n\n` +
            `✅ Click the button below to agree.`;
        
        const row = new ActionRowBuilder()
            .addComponents(new ButtonBuilder().setCustomId('agree_rules').setLabel('✅ I Agree').setStyle(ButtonStyle.Success));
        
        await interaction.reply({ content: rulesMessage, components: [row] });
    }
    
    if (interaction.commandName === 'say') {
        const message = interaction.options.getString('message');
        await interaction.reply({ content: '✅ Message sent!', ephemeral: true });
        await interaction.channel.send(message);
    }
    
    if (interaction.commandName === 'testlive') {
        if (!DISCORD_CHANNEL_ID) {
            await interaction.reply('❌ Use /setchannel first!');
            return;
        }
        await interaction.reply({ content: '🧪 Sending test announcement...', ephemeral: true });
        await sendAnnouncement();
    }
    
    if (interaction.commandName === 'setchannel') {
        const channel = interaction.options.getChannel('channel');
        DISCORD_CHANNEL_ID = channel.id;
        await interaction.reply(`✅ Twitch notifications will now be sent to ${channel}!`);
    }
    
    // MODERATION COMMANDS
    if (interaction.commandName === 'timeout') {
        const user = interaction.options.getUser('user');
        const minutes = interaction.options.getInteger('minutes');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id);
        await member.timeout(minutes * 60 * 1000, reason);
        try { await user.send(`⏰ You have been timed out in ${interaction.guild.name} for ${minutes} minutes.\n**Reason:** ${reason}`); } catch(e) {}
        await interaction.reply(`✅ ${user.tag} has been timed out for ${minutes} minutes.\nReason: ${reason}`);
    }
    
    if (interaction.commandName === 'warn') {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        let userWarnings = warnings.get(user.id) || [];
        userWarnings.push({ reason, date: new Date(), moderator: interaction.user.tag });
        warnings.set(user.id, userWarnings);
        try { await user.send(`⚠️ You have received a warning in ${interaction.guild.name}.\n**Reason:** ${reason}\n**Total warnings:** ${userWarnings.length}`); } catch(e) {}
        await interaction.reply(`⚠️ ${user.tag} has been warned.\nReason: ${reason}\nTotal warnings: ${userWarnings.length}`);
        if (userWarnings.length >= 3) {
            const member = await interaction.guild.members.fetch(user.id);
            await member.timeout(7 * 24 * 60 * 60 * 1000, '3 warnings');
            await interaction.followUp(`${user.tag} has been automatically timed out for 1 week due to 3 warnings.`);
        }
    }
    
    if (interaction.commandName === 'kick') {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id);
        try { await user.send(`👢 You have been kicked from ${interaction.guild.name}.\n**Reason:** ${reason}`); } catch(e) {}
        await member.kick(reason);
        await interaction.reply(`👢 ${user.tag} has been kicked.\nReason: ${reason}`);
    }
    
    if (interaction.commandName === 'ban') {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        try { await user.send(`🔨 You have been banned from ${interaction.guild.name}.\n**Reason:** ${reason}`); } catch(e) {}
        await interaction.guild.members.ban(user.id, { reason });
        await interaction.reply(`🔨 ${user.tag} has been banned.\nReason: ${reason}`);
    }
    
    if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('amount');
        if (amount > 100 || amount < 1) return interaction.reply('❌ Please provide a number between 1 and 100.');
        await interaction.channel.bulkDelete(amount);
        await interaction.reply({ content: `✅ Cleared ${amount} messages.`, ephemeral: true });
    }
    
    if (interaction.commandName === 'announce') {
        const announcement = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('📢 ANNOUNCEMENT').setDescription(announcement).setFooter({ text: `Announced by ${interaction.user.tag}` }).setTimestamp();
        await channel.send({ content: '@everyone', embeds: [embed] });
        await interaction.reply({ content: '✅ Announcement sent!', ephemeral: true });
    }
    
    // FUN COMMANDS
    if (interaction.commandName === 'calc') {
        const math = interaction.options.getString('math');
        try { const result = eval(math); await interaction.reply(`🧮 **${math}** = ${result}`); } catch { await interaction.reply('❌ Invalid math expression!'); }
    }
    
    if (interaction.commandName === 'roll') {
        const sides = interaction.options.getInteger('sides') || 6;
        const count = interaction.options.getInteger('count') || 1;
        let results = [];
        for (let i = 0; i < count; i++) results.push(Math.floor(Math.random() * sides) + 1);
        await interaction.reply(`🎲 Rolled ${count}d${sides}: **${results.join(', ')}**`);
    }
    
    if (interaction.commandName === 'random') {
        const min = interaction.options.getInteger('min');
        const max = interaction.options.getInteger('max');
        const random = Math.floor(Math.random() * (max - min + 1)) + min;
        await interaction.reply(`🎲 Random number between ${min} and ${max}: **${random}**`);
    }
    
    if (interaction.commandName === '8ball') {
        const question = interaction.options.getString('question');
        const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask again later', 'Most likely', 'Outlook not good'];
        const answer = answers[Math.floor(Math.random() * answers.length)];
        await interaction.reply(`🎱 **Question:** ${question}\n**Answer:** ${answer}`);
    }
    
    if (interaction.commandName === 'cat') {
        try { const response = await axios.get('https://api.thecatapi.com/v1/images/search'); await interaction.reply(response.data[0].url); } catch { await interaction.reply('https://cataas.com/cat'); }
    }
    
    if (interaction.commandName === 'dog') {
        try { const response = await axios.get('https://dog.ceo/api/breeds/image/random'); await interaction.reply(response.data.message); } catch { await interaction.reply('https://images.dog.ceo/breeds/hound-afghan/n02088094_1003.jpg'); }
    }
    
    if (interaction.commandName === 'fact') {
        const facts = ['Octopuses have three hearts.', 'Bananas are berries, but strawberries are not.', 'A day on Venus is longer than a year on Venus.', 'Honey never spoils.', 'Cows have best friends.'];
        await interaction.reply(`📖 **Fact:** ${facts[Math.floor(Math.random() * facts.length)]}`);
    }
    
    if (interaction.commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`🏓 Pong! Latency: ${latency}ms`);
    }
    
    if (interaction.commandName === 'avatar') {
        const user = interaction.options.getUser('user') || interaction.user;
        await interaction.reply(`${user.displayAvatarURL({ size: 1024 })}`);
    }
    
    if (interaction.commandName === 'serverinfo') {
        const guild = interaction.guild;
        await interaction.reply(`**📊 SERVER INFO**\n\n📛 Name: ${guild.name}\n👥 Members: ${guild.memberCount}\n📅 Created: ${guild.createdAt.toDateString()}\n👑 Owner: <@${guild.ownerId}>`);
    }
    
    if (interaction.commandName === 'userinfo') {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);
        await interaction.reply(`**👤 USER INFO**\n\n📛 Name: ${user.tag}\n🆔 ID: ${user.id}\n📅 Joined Discord: ${user.createdAt.toDateString()}\n📅 Joined Server: ${member.joinedAt.toDateString()}`);
    }
});

client.login(process.env.TOKEN);