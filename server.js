const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// health check route
app.get('/', (req, res) => {
    res.send('Bot is alive!');
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

// start bot AFTER server is up
require('./bot.js');
