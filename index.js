const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const Pino = require("pino");
const readline = require("readline");

// Setup readline for interactive user inputs
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

            // Ask the user to enter their phone number
            const phoneNumber = await new Promise((resolve) => {
                rl.question("Enter your phone number (e.g., 40756469325): ", resolve);
            });

            // Request the pairing code
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
                    process.exit(1); // Exit the script if logged out
                }
            }
        });

        // Save credentials whenever they update
        socket.ev.on("creds.update", saveCreds);

        return socket;
    };

    const socket = await startWhatsApp();

    // Function to get user input asynchronously
    const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

    // Main function to handle message sending
    const main = async () => {
        console.log("Where would you like to send messages?");
        console.log("[1] Contact");
        console.log("[2] Group");

        // Get user's choice
        const choice = await askQuestion("Enter your choice: ");

        let target = "";
        if (choice === "1") {
            const targetNumber = await askQuestion("Enter the phone number (without + or spaces, e.g., 40756469325): ");
            target = `${targetNumber}@s.whatsapp.net`; // JID for individual contacts
        } else if (choice === "2") {
            target = await askQuestion("Enter the group JID (e.g., 1234567890-123456@g.us): ");
        } else {
            console.log("Invalid choice. Exiting.");
            rl.close();
            process.exit(1);
        }

        const message = await askQuestion("Enter the message you want to send: ");
        const delay = parseInt(await askQuestion("Enter the delay in seconds between messages: "), 10) * 1000;

        console.log("Sending messages... Press CTRL+C to stop.");

        const sendMessage = async () => {
            try {
                await socket.sendMessage(target, { text: message });
                console.log(`Message sent to ${target}: ${message}`);
            } catch (error) {
                console.error(`Failed to send message to ${target}:`, error);
            }
        };

        // Infinite loop to send messages with the specified delay
        while (true) {
            await sendMessage();
            await new Promise((resolve) => setTimeout(resolve, delay)); // Wait for the specified delay
        }
    };

    await main(); // Start the main function
})();
