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
// Safety filters
// --------------------
const DEFAULT_EXCLUDES = [
    'baby','babies','diaper','loli','shota','cub','minor','underage',
    'child','preteen','infant','kid','juvenile','schoolgirl','schoolboy',
    'babyfur','gore','blood','violence','decapitation','torture','death','corpse',
    'ai','generated','synthetic'
];

// --------------------
// Slash command register
// --------------------
const commands = [
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search e621 posts')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('tags + filters')
                .setRequired(true)
        )
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: commands
        });
        console.log("Slash command registered");
    } catch (err) {
        console.error(err);
    }
})();

// --------------------
// Ready
// --------------------
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// --------------------
// Helper: parse query
// --------------------
function parse(query) {
    const parts = query.split(/\s+/);

    let include = [];
    let exclude = [...DEFAULT_EXCLUDES];

    for (const p of parts) {
        if (p.startsWith('-')) exclude.push(p.slice(1));
        else include.push(p);
    }

    return {
        tags: [...include, ...exclude.map(t => `-${t}`)].join('+')
    };
}

// --------------------
// Command handler
// --------------------
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'search') {
        const query = i.options.getString('query');

        await i.reply("Searching... 🔎");

        try {
            const { tags } = parse(query);

            const res = await axios.get(
                `https://e621.net/posts.json?tags=${tags}&limit=50`,
                {
                    headers: {
                        'User-Agent': 'FuzzBot/1.0 (by Fuzz)'
                    },
                    timeout: 10000
                }
            );

            const posts = res.data.posts;

            if (!posts.length) {
                return i.editReply("No results 😭");
            }

            const post = posts[Math.floor(Math.random() * posts.length)];

            const tagList = post.tags.general.slice(0, 15).join(', ');

            await i.editReply(
`Result for: ${query}
${post.sample.url}

-# ${tagList}
-# Score: ${post.score.total} | ❤️ ${post.fav_count}
-# ${post.file.width}x${post.file.height}`
            );

        } catch (err) {
            console.error(err);
            i.editReply("Error fetching posts 💀");
        }
    }
});

client.login(TOKEN);
