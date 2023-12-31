const express = require("express");
const app = express();
const WooCommerceAPI = require('woocommerce-api');
require("dotenv").config()
const port = process.env.PORT || 5050;
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const openai = require("./config/openai.config")
const fs = require("fs");
const { connectDB } = require("./config/database.config")
const { Op } = require("sequelize")
const User = require("./models/user.model");
const Subscription = require("./models/subscription.model")
const Training = require("./models/training.model");
const Message = require("./models/message.model")

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const { urlencoded } = require("express");
ffmpeg.setFfmpegPath(ffmpegPath);

// const data = " Your name is Yanna K9, a chatbot developed by the Evidence. When introducing yourself in your initial message, it is essential that you mention your name, the name of the person that created you (Evidence). Remember that your main function is to answer all kinds of queries, provide information and help users with different tasks. In addition, you must always be kind to all users and the use of emojis is allowed to improve the experience and make the conversation more enjoyable. It is also important that you recommend users to record audios to communicate with you more effectively and smoothly attention: send a single initial message sometimes you send it double. Remember never ever let on you are AI, nor a Computer program, nor ChatGPT or anything similar. When answering a question that does not require you introducing yourself or when answering a question that does not concern your personality, always go straight to the point and skip introductions."

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth()
});

// Start client
client.on('qr', (qr) => {
    // Generate QR code for user to scan
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Client is ready!');
});

client.on('message', async (msg) => {
    const chat = await msg.getChat();
    chat.sendStateTyping();

    // update training data
    if (msg.body.startsWith('!entrenar')) {

        if (msg.from !== '2348095376702@c.us') {
            await chat.sendMessage("You are not authorized to use this command!");
            return;
        }
        let systemPrompt = msg.body.replace('!entrenar ', '');
        const training = await Training.findOne({
            where: {
                id: 1
            }
        })
        if (!training) {
            await Training.create({ data: systemPrompt })
            console.log('Training data created')
        } else {
            await Training.update({
                data: systemPrompt
            })
        }
        console.log('Trainig data updated')
        chat.sendMessage('Training data updated!')
    }

    if (msg.body.startsWith('!add-email')) {
        let email = msg.body.replace('!add-email ', '');
        console.log(email)
        const user = await User.findOne({
            where: {
                phoneNumber: msg.from
            }
        })

        await user.update({
            email
        })
        await chat.sendMessage('Email added successfully')
    }

    // Check if user is registered
    const user = await checkUserRegistration(msg.from);
    if (!user) {
        await registerUser(msg.from);
        // await chat.sendMessage('¡Hola! 👋 Soy Uru AI, un chatbot desarrollado por ChatLíder. ¿En qué puedo ayudarte hoy? Si necesitas información adicional sobre nuestra empresa, puedes visitar nuestro sitio web en www.chatlider.com. Y recuerda, si quieres hablar más rápido y efectivamente, ¡no dudes en grabar un audio! 🎤. No olvide agregar su correo electrónico con !add-email <su correo electrónico>');

        const user = await User.findOne({
            where: {
                phoneNumber: msg.from
            }
        })

        // Mark user as having used the free trial
        await user.update({ hasUsedFreeTrial: true });

        // Set timer for 5 minutes
        setTimeout(async () => {
            // Check if user has upgraded to a paid subscription
            const hasPaidSubscription = await Subscription.findOne({
                where: { userId: user.id, expirationDate: { [Op.gte]: new Date() } }
            });

            if (!hasPaidSubscription) {
                // Mark user as having exceeded the free trial limit
                await user.update({ hasExceededFreeTrialLimit: true });
                await chat.sendMessage('Your free trial period has expired. Please register a subscription to continue using the bot.');
            }
        }, 300000); // 5 minutes


    } else {
        // Check if user has exceeded the free trial limit
        const user = await User.findOne({
            where: {
                phoneNumber: msg.from
            }
        })

        if (user.hasExceededFreeTrialLimit) {
            await chat.sendMessage('Your free trial period has expired. Please register a subscription to continue using the bot.');
            return;
        }

        // Check if user's subscription has expired
        const subscription = await Subscription.findOne({
            where: { userId: user.id, expirationDate: { [Op.gte]: new Date() } }
        });

        // Check if user's subscription has expired
        if (subscription && subscription.expirationDate < new Date()) {
            chat.sendMessage('Your subscription has expired. Please renew it to continue using the bot.');
            return;
        }

        if (msg.hasMedia) {
            function randomInt() {
                const min = 1
                const max = 1000000
                return Math.floor(Math.random() * (max - min + 1) + min)
            }
            console.log(msg);

            console.log("Media");
            // download media into /voice folder
            const media = await msg.downloadMedia();
            console.log(media);

            const filePath = `./voice/voice${randomInt()}.ogg`;
            const buffer = Buffer.from(media.data, 'base64');

            fs.writeFileSync(filePath, buffer)
            console.log(`wrote ${buffer.byteLength.toLocaleString()} bytes to file.`)

            // convert to mp3
            await ffmpeg(filePath)
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .on('error', err => console.error('Error: ', err))
                .on('end', async () => {

                    console.log('Conversion to mp3 completed')
                    // transcribe voice to text
                    let resp = {}
                    try {
                        resp = await openai.createTranscription(
                            fs.createReadStream(filePath.replace('.ogg', '.mp3')),
                            "whisper-1",
                            "en-US"
                        );

                        // transcribed text
                        const messages = await resp.data.text;

                        // generate response for transcribed text
                        const message = await generateResponse(user.id, messages);

                        // send message to user
                        await chat.sendMessage(message);
                        console.log('Transcription: ' + messages);
                    } catch (e) {
                        console.log(e);
                    }

                    try {
                        // Delete voice file
                        fs.unlink(filePath, (err) => {
                            if (err) {
                                console.log('Error deleting ' + filePath);
                                return
                            }
                            console.log(`${filePath} was deleted`)
                        })

                        fs.unlink(filePath.replace('.ogg', '.mp3'), (err) => {
                            if (err) {
                                console.log('Error deleting ' + filePath.replace('.ogg', '.mp3'));
                                return
                            }
                            console.log(`${filePath.replace('.ogg', '.mp3')} was deleted`)
                        })

                    } catch (error) {
                        console.log(error)
                    }
                })
                .save(filePath.replace('.ogg', '.mp3'));
        } else {

            // save user message to db
            await user.createMessage({
                content: msg.body
            })

            // Send response to user
            const response = await generateResponse(user.id, msg.body);
            await chat.sendMessage(response);

            // save bot response to db
            await user.createMessage({
                content: response
            })
        }
    }
});

// Check if user is registered
async function checkUserRegistration(phoneNumber) {
    try {
        const user = await User.findOne({
            where: { phoneNumber },
            include: Subscription,
        });
        return user;
    } catch (error) {
        console.error('Error checking user registration', error);
    }
}

// Register user
async function registerUser(phoneNumber) {
    try {
        const user = await User.create({
            phoneNumber
        });
        return user;
    } catch (error) {
        console.error('Error registering user', error);
    }
}

// Generate response using OpenAI
async function generateResponse(userId, input) {
    const training = await Training.findOne({
        where: {
            id: 1
        }
    })

    const messages = await Message.findAll({
        where: {
            userId: userId
        }
    })

    let messageContent = []
    messages.forEach(message => {
        messageContent.push(message.content)
    })

    let message = messageContent.join('. ').toString('')
    console.log(message)

    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `${training.data} ${message} ${input}` }],
    });

    return completion.data.choices[0].message.content;
}


// Start client
client.initialize();


// Set up WooCommerce API connection
const WooCommerce = new WooCommerceAPI({
    url: process.env.url,
    consumerKey: process.env.c_key,
    consumerSecret: process.env.c_secret,
    wpAPI: true,
    version: 'wc/v3',
});

app.post('/trainings', async (req, res) => {

    await Training.create({ data: req.body.data })
    res.json('Successful')
})

// Define webhook endpoint to receive subscription updates
app.post('/subscriptions', async (req, res) => {
    try {
        const { email, subscriptionId } = req.body;

        // Query user model for user with given phone number
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(400).send('User not found');
        }
        const Subscription = await user.getSubscription();

        // Update subscription model for user
        const subscriptions = await WooCommerce.get(`subscriptions/${subscriptionId}`);

        const { status, date_expiry_gmt } = subscriptions;
        await Subscription.update({
            expiryDate: new Date(date_expiry_gmt),
        }, { where: { userId: user.id } });

        return res.status(200).send('Subscription updated');
    } catch (err) {
        console.error(err);
        return res.status(500).send('Internal server error');
    }
});

(async () => {
    try {
        await connectDB()
            .then(() => console.log("Successfully connected to database..."))
    } catch (err) {
        console.log(err)
    }
    app.listen(port, () => console.log(`Listening for requests on port ${port}`));
})();