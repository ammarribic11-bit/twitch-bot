require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const commands = [
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands')
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.on('ready', async () => {
    console.log(`${client.user.tag} is online!`);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(cmd => cmd.toJSON()) });
    console.log('Commands registered!');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    
    if (interaction.commandName === 'help') {
        await interaction.reply(`
**📋 Available Commands**

/help - Shows this message

🟢 Bot Status: Online
        `);
    }
});

client.login(process.env.TOKEN);