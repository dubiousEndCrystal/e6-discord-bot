const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    Routes,
    REST
} = require('discord.js');

const axios = require('axios');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ----------------------
// safety crash logs
// ----------------------
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// ----------------------
// excluded tags
// ----------------------
const DEFAULT_EXCLUDES = [
    'baby','babies','diaper','loli','shota','cub','minor','underage',
    'child','preteen','infant','kid','juvenile','schoolgirl','schoolboy',
    'babyfur','gore','blood','violence','decapitation','torture','death','corpse',
    'ai','generated','synthetic'
];

// ----------------------
// register slash command
// ----------------------
const commands = [
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search e621 images')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('tags, -exclude tags supported')
                .setRequired(true)
        )
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log("Registering slash command...");
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log("Slash command registered!");
    } catch (err) {
        console.error(err);
    }
})();

// ----------------------
// ready event
// ----------------------
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// ----------------------
// parse tags
// ----------------------
function buildQuery(input) {
    const parts = input.split(/\s+/);

    let include = [];
    let exclude = [...DEFAULT_EXCLUDES];

    for (const p of parts) {
        if (p.startsWith('-')) {
            exclude.push(p.slice(1));
        } else {
            include.push(p);
        }
    }

    return [...include, ...exclude.map(t => `-${t}`)].join('+');
}

// ----------------------
// command handler
// ----------------------
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'search') {
        try {
            await i.deferReply(); // IMPORTANT FIX

            const query = i.options.getString('query');

            const tagQuery = buildQuery(query);

            const url = `https://e621.net/posts.json?tags=${encodeURIComponent(tagQuery)}&limit=50`;

            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'FuzzBot/1.0 (by Fuzz)'
                },
                timeout: 10000
            });

            const posts = res.data.posts;

            if (!posts || posts.length === 0) {
                return i.editReply("No results 😭");
            }

            const post = posts[Math.floor(Math.random() * posts.length)];

            const tags = post.tags.general.slice(0, 15).join(', ');

            await i.editReply(
`Result for: ${query}

${post.sample.url}

-# ${tags}
-# Score: ${post.score.total} | ❤️ ${post.fav_count}
-# ${post.file.width}x${post.file.height}`
            );

        } catch (err) {
            console.error(err);
            if (i.deferred || i.replied) {
                i.editReply("Something broke 💀");
            } else {
                i.reply("Something broke 💀");
            }
        }
    }
});

client.login(TOKEN);
