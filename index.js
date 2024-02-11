const { PlayFabServer } = require("playfab-sdk");
var PlayFab = require("./node_modules/playfab-sdk/Scripts/PlayFab/PlayFab");
var PlayFabClient = require("./node_modules/playfab-sdk/Scripts/PlayFab/PlayFabClient");

PlayFab.settings.titleId = "D1159";
PlayFab.settings.developerSecretKey = "R3SP6WWQKDOG6POAKENUAGQTSJSFRKN7QBJXH88SUTMJ76OZIF";

var sessionTicket = "2953E29722F89E4B-3DA2D9EAD39C3961-30A4F2A6B81E94C9-D1159-8DC2B54C0A7B60C-TQ5180dvNI2wIDZFn42HYB+A0R9NoKOiEqoCUX6F1Mw=";

function authenticateSessionTicket(sessionTicket) {
    var request = {
        //secret key and session ticket
        SessionTicket: sessionTicket,
        };
    PlayFabServer.AuthenticateSessionTicket(request, function (error, result) {
        if (error) {
            console.log("Got an error: ", error);
        } else {
            console.log("Got a result: ", result);
        }
    });
}

authenticateSessionTicket(sessionTicket);