const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/games', (req, res) => {
    res.sendFile(__dirname + '/public/games.html');
});

app.get('/games/:id', (req, res) => {
    const id= req.params.id;
        res.send ("Game detail for game " + id);
})

app.get('/import', (req, res) => {
    res.sendFile(__dirname + '/public/import.html');
});

app.listen(port, () => {
    console.log(`Server is running and listening on port ${port}`);
});