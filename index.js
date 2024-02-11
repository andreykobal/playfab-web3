const express = require('express');
const bodyParser = require('body-parser');
const { PlayFabServer } = require('playfab-sdk');

// Initialize PlayFab configuration
PlayFabServer.settings.titleId = "D1159";
PlayFabServer.settings.developerSecretKey = "R3SP6WWQKDOG6POAKENUAGQTSJSFRKN7QBJXH88SUTMJ76OZIF";

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

app.post('/authenticate', (req, res) => {
    const sessionTicket = req.body.sessionTicket;

    if (!sessionTicket) {
        return res.status(400).send({ message: 'Session ticket is required' });
    }

    const request = {
        SessionTicket: sessionTicket,
    };

    PlayFabServer.AuthenticateSessionTicket(request, (error, result) => {
        if (error) {
            console.error("Got an error: ", error);
            res.status(500).send({ message: "Authentication failed", error });
        } else {
            console.log("\x1b[36m%s\x1b[0m", "Got a result: ", result); // Cyan
            res.send({ message: "Authentication successful" }); // Only tells the user that authentication was successful
        }
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
