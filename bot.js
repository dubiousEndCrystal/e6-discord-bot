// bot.js
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, REST } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

//client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

//reg
const commands = [
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search images from e621')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Tags to search for, use -tag to exclude')
                .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Registering slash command...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('Slash command registered!');
    } catch (err) {
        console.error(err);
    }
})();

//exclude
const DEFAULT_EXCLUDES = [
    // minors / baby stuff
    'baby','babies','diaper','loli','shota','cub','minor','underage',
    'child','preteen','infant','kid','juvenile','young','elementary',
    'schoolgirl','schoolboy','babyfur',
    
    // AI-generated / bot stuff
    'ai','generated','synthetic',

    // gore / extreme stuff
    'gore','blood','violence','decapitation','disembowelment','brutal',
    'mutilation','torture','death','corpse'
];

//ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

//cmd
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'search') {
        const userQuery = interaction.options.getString('query').trim();

        // split user input into included and excluded tags
        const parts = userQuery.split(/\s+/);
        let includeTags = [];
        let excludeTags = [...DEFAULT_EXCLUDES];

        for (const part of parts) {
            if (part.startsWith('-') && part.length > 1) {
                excludeTags.push(part.slice(1));
            } else {
                includeTags.push(part);
            }
        }

        // convert
        const includeString = includeTags.join('+');
        const excludeString = excludeTags.map(tag => `-${tag}`).join('+');

        const filteredQuery = `${includeString}+status:active+${excludeString}`;
        const url = `https://e621.net/posts?tags=${filteredQuery}`;

        await interaction.reply('Searching... Gimme a second...');

        try {
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'DiscordBot (by YOUR_USERNAME)' }
            });

            const $ = cheerio.load(res.data);

            // grab all posts
            const posts = $('article').map((i, el) => {
                return {
                    image: $(el).attr('data-sample-url'),
                    tags: $(el).attr('data-tags').split(' ')
                };
            }).get();

            if (posts.length === 0) {
                return interaction.editReply('-# But nobody came...');
            }

            // pick a random post
            const post = posts[Math.floor(Math.random() * posts.length)];

            // format tags
            const formattedTags = post.tags.map(tag => 
                includeTags.includes(tag) ? `**${tag}**` : tag
            ).join(', ');

            await interaction.editReply({
                content: `Result for: ${userQuery}\n${post.image}\n-# ${formattedTags}`
            });

        } catch (err) {
            console.error(err);
            await interaction.editReply('Something broke lmfao');
        }
    }
});

// ----------------------------
// Login
// ----------------------------
client.login(TOKEN);
