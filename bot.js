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

// --------------------
// crash protection
// --------------------
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// --------------------
// filters
// --------------------
const DEFAULT_EXCLUDES = [
    'baby','babies','diaper','loli','shota','cub','minor','underage',
    'child','preteen','infant','kid','juvenile','schoolgirl','schoolboy',
    'babyfur','gore','blood','violence','decapitation','torture','death','corpse',
    'ai','generated','synthetic'
];

// --------------------
// slash command
// --------------------
const commands = [
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search e621 posts')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('tags (-exclude supported)')
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

// --------------------
// ready
// --------------------
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// --------------------
// query builder
// --------------------
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

// --------------------
// interaction handler (FIXED)
// --------------------
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    if (i.commandName !== 'search') return;

    try {
        console.log("COMMAND RECEIVED");

        await i.deferReply(); // CRITICAL FIX

        const query = i.options.getString('query');

        const tags = buildQuery(query);

        console.log("FETCH:", tags);

        let res;
        try {
            res = await axios.get(
                `https://e621.net/posts.json?tags=${encodeURIComponent(tags)}&limit=50`,
                {
                    headers: {
                        'User-Agent': 'FuzzBot/1.0 (by Fuzz)'
                    },
                    timeout: 15000
                }
            );
        } catch (err) {
            console.log("API ERROR:", err.message);
            return i.editReply("e621 request failed 💀");
        }

        const posts = res.data.posts;

        if (!posts || posts.length === 0) {
            return i.editReply("No results 😭");
        }

        const post = posts[Math.floor(Math.random() * posts.length)];

        const tagsOut = post.tags.general.slice(0, 15).join(', ');

        await i.editReply(
`Result for: ${query}

${post.sample.url}

-# ${tagsOut}
-# Score: ${post.score.total} | ❤️ ${post.fav_count}
-# ${post.file.width}x${post.file.height}`
        );

    } catch (err) {
        console.error("FATAL:", err);

        try {
            if (i.deferred) {
                await i.editReply("bot error 💀");
            } else {
                await i.reply("bot error 💀");
            }
        } catch {}
    }
});

client.login(TOKEN);
