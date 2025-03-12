const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const Pino = require("pino");
const readline = require("readline");

// Configure readline for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

(async () => {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

    // Function to start the WhatsApp session with pairing code
    const startWhatsApp = async () => {
        const socket = makeWASocket({
            auth: state,
            logger: Pino({ level: "silent" })
        });

        // Check if credentials are already registered
        if (!socket.authState.creds.registered) {
            console.log("Your WhatsApp session is not registered yet.");

            // Request a pairing code from the API
            const phoneNumber = await new Promise((resolve) => {
                rl.question("Enter your phone number (e.g., 40756469325): ", resolve);
            });

            const pairingCode = await socket.requestPairingCode(phoneNumber);
            console.log(`Pairing Code: ${pairingCode}`);
            console.log("Please enter this pairing code into your WhatsApp app under Linked Devices.");
        } else {
            console.log("You are already authenticated!");
        }

        // Handle connection updates
        socket.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "open") {
                console.log("Connected to WhatsApp!");
            } else if (connection === "close") {
                if (lastDisconnect?.error?.output?.statusCode) {
                    console.log("Connection closed. Attempting to reconnect...");
                } else {
                    console.error("Logged out. Please restart the script for authentication.");
                    process.exit(1); // Exit script if logged out
                }
            }
        });

        // Save credentials when they change
        socket.ev.on("creds.update", saveCreds);

        return socket;
    };

    const
