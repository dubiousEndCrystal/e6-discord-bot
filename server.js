const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is alive');
});

app.listen(PORT, () => {
    console.log("Web server running on port " + PORT);

    // START BOT HERE (AFTER SERVER IS UP)
    require('./bot.js');
});
