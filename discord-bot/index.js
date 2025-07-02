require("dotenv").config()
const { Client, GatewayIntentBits } = require("discord.js")
const axios = require("axios")

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

client.once("ready", () => {
    console.log(`🤖 Bot is ready: ${client.user.tag}`)
})

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith("/ask")) {
        const question = message.content.replace("/ask", "").trim()
        await message.channel.sendTyping()

        try {
            const res = await axios.post("http://localhost:8000/query", {
                user_id: message.author.id,
                question: question,
            });

            await message.reply(`📘 **Answer:** ${res.data.answer}`)
        } catch (err) {
            console.error(err)
            await message.reply("⚠️ Sorry, there was an error processing your request.")
        }
    }
})

client.login(process.env.DISCORD_TOKEN)