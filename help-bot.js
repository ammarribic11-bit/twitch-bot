require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const commands = [
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands'),
    
    new SlashCommandBuilder()
        .setName('createchannels')
        .setDescription('Create multiple channels (OWNER ONLY)')
        .addIntegerOption(option => option.setName('amount').setDescription('Number of channels').setRequired(true))
        .addStringOption(option => option.setName('name').setDescription('Channel name base').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('deletechannels')
        .setDescription('Delete ALL channels (OWNER ONLY - VERY DANGEROUS)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('createcategories')
        .setDescription('Create multiple categories (OWNER ONLY)')
        .addIntegerOption(option => option.setName('amount').setDescription('Number of categories').setRequired(true))
        .addStringOption(option => option.setName('name').setDescription('Category name base').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('deletecategories')
        .setDescription('Delete ALL categories (OWNER ONLY)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

const rest = new REST({ version: '1000' }).setToken(process.env.TOKEN);

client.on('ready', async () => {
    console.log(`${client.user.tag} is online!`);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(cmd => cmd.toJSON()) });
    console.log('Commands registered!');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    
    if (interaction.commandName === 'help') {
        await interaction.reply(`
**📋 Commands (OWNER ONLY)**

/createchannels <amount> <name> - Creates channels
/deletechannels - DELETES ALL CHANNELS
/createcategories <amount> <name> - Creates categories  
/deletecategories - DELETES ALL CATEGORIES

⚠️ ONLY USE ON YOUR OWN TEST SERVER!
        `);
    }
    
    if (interaction.commandName === 'createchannels') {
        const amount = Math.min(interaction.options.getInteger('amount'), 10);
        const name = interaction.options.getString('name');
        
        await interaction.reply(`🔄 Creating ${amount} channels...`);
        
        for (let i = 1; i <= amount; i++) {
            await interaction.guild.channels.create({
                name: `${name}-${i}`,
                type: 0
            }).catch(() => {});
        }
        
        await interaction.editReply(`✅ Created ${amount} channels!`);
    }
    
    if (interaction.commandName === 'deletechannels') {
        await interaction.reply('⚠️ DELETING ALL CHANNELS IN 5 SECONDS! Type /cancel to stop...');
        
        const channels = interaction.guild.channels.cache;
        for (const channel of channels.values()) {
            await channel.delete().catch(() => {});
        }
        
        await interaction.editReply('✅ All channels deleted!');
    }
    
    if (interaction.commandName === 'createcategories') {
        const amount = Math.min(interaction.options.getInteger('amount'), 10);
        const name = interaction.options.getString('name');
        
        await interaction.reply(`🔄 Creating ${amount} categories...`);
        
        for (let i = 1; i <= amount; i++) {
            await interaction.guild.channels.create({
                name: `${name}-${i}`,
                type: 4
            }).catch(() => {});
        }
        
        await interaction.editReply(`✅ Created ${amount} categories!`);
    }
    
    if (interaction.commandName === 'deletecategories') {
        await interaction.reply('⚠️ DELETING ALL CATEGORIES...');
        
        const categories = interaction.guild.channels.cache.filter(ch => ch.type === 4);
        for (const category of categories.values()) {
            await category.delete().catch(() => {});
        }
        
        await interaction.editReply('✅ All categories deleted!');
    }
});

client.login(process.env.TOKEN);
