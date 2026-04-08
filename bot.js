require('./server.js');
const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    Routes,
    REST,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const axios = require('axios');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

//command
const commands = [
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Advanced e621 search')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('tags, -exclude, >score, fav>100, width>1000')
                .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

//excludes
const DEFAULT_EXCLUDES = [
    'baby','babies','diaper','loli','shota','cub','minor','underage',
    'child','preteen','infant','kid','juvenile','young','elementary',
    'schoolgirl','schoolboy','babyfur',
    'ai','generated','synthetic',
    'gore','blood','violence','decapitation','disembowelment',
    'mutilation','torture','death','corpse'
];

// Ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Query parser
function parseQuery(query) {
    const parts = query.trim().split(/\s+/);

    let include = [];
    let exclude = [...DEFAULT_EXCLUDES];

    let filters = {
        score: null,
        fav: null,
        width: null,
        height: null
    };

    for (const part of parts) {
        if (part.startsWith('-')) {
            exclude.push(part.slice(1));
        }

        else if (/^(>=|<=|>|<)\d+$/.test(part)) {
            filters.score = {
                op: part.match(/^(>=|<=|>|<)/)[0],
                val: parseInt(part.replace(/^(>=|<=|>|<)/, ''))
            };
        }

        else if (/^fav(>=|<=|>|<)\d+$/.test(part)) {
            const op = part.match(/(>=|<=|>|<)/)[0];
            const val = parseInt(part.replace(/fav(>=|<=|>|<)/, ''));
            filters.fav = { op, val };
        }

        else if (/^width(>=|<=|>|<)\d+$/.test(part)) {
            const op = part.match(/(>=|<=|>|<)/)[0];
            const val = parseInt(part.replace(/width(>=|<=|>|<)/, ''));
            filters.width = { op, val };
        }

        else if (/^height(>=|<=|>|<)\d+$/.test(part)) {
            const op = part.match(/(>=|<=|>|<)/)[0];
            const val = parseInt(part.replace(/height(>=|<=|>|<)/, ''));
            filters.height = { op, val };
        }

        else {
            include.push(part);
        }
    }

    return { include, exclude, filters };
}

// Filter helper
function check(val, filter) {
    if (!filter) return true;

    switch (filter.op) {
        case '>': return val > filter.val;
        case '<': return val < filter.val;
        case '>=': return val >= filter.val;
        case '<=': return val <= filter.val;
    }
}

// Command handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    // SEARCH COMMAND
    if (interaction.isChatInputCommand()) {
        const userQuery = interaction.options.getString('query');

        const { include, exclude, filters } = parseQuery(userQuery);

        const tagString = [
            ...include,
            ...exclude.map(t => `-${t}`)
        ].join('+');

        await interaction.reply('Searching... 🔎');

        try {
            const res = await axios.get(
                `https://e621.net/posts.json?tags=${tagString}&limit=100`,
                {
                    headers: {
                        'User-Agent': 'FuzzBot/1.0 (by Fuzz)'
                    }
                }
            );

            let posts = res.data.posts;

            // apply filters
            posts = posts.filter(p =>
                check(p.score.total, filters.score) &&
                check(p.fav_count, filters.fav) &&
                check(p.file.width, filters.width) &&
                check(p.file.height, filters.height)
            );

            if (!posts.length) {
                return interaction.editReply('No matching posts 😭');
            }

            let index = 0;

            const buildMessage = () => {
                const p = posts[index];

                const tags = p.tags.general.map(tag =>
                    include.includes(tag) ? `**${tag}**` : tag
                ).slice(0, 20).join(', ');

                return {
                    content:
`Result for: ${userQuery}
${p.sample.url}
-# ${tags}
-# Score: ${p.score.total} | Favorites: ${p.fav_count}
-# ${p.file.width}x${p.file.height}`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev')
                                .setLabel('⮜⬩')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('next')
                                .setLabel('⬩⮞')
                                .setStyle(ButtonStyle.Primary)
                        )
                    ]
                };
            };

            await interaction.editReply(buildMessage());

            // store session
            interaction.client.sessions ??= {};
            interaction.client.sessions[interaction.id] = {
                posts,
                index,
                include,
                userQuery
            };

        } catch (err) {
            console.error(err);
            interaction.editReply('Something broke 💀');
        }
    }

    // BUTTON HANDLER
    if (interaction.isButton()) {
        const session = interaction.client.sessions?.[interaction.message.interaction.id];
        if (!session) return;

        if (interaction.customId === 'next') {
            session.index = (session.index + 1) % session.posts.length;
        } else {
            session.index = (session.index - 1 + session.posts.length) % session.posts.length;
        }

        const p = session.posts[session.index];

        const tags = p.tags.general.map(tag =>
            session.include.includes(tag) ? `**${tag}**` : tag
        ).slice(0, 20).join(', ');

        await interaction.update({
            content:
`Result for: ${session.userQuery}
${p.sample.url}
-# ${tags}
-# Score: ${p.score.total} | Favorites: ${p.fav_count}
-# ${p.file.width}x${p.file.height}`
        });
    }
});

client.login(TOKEN);
