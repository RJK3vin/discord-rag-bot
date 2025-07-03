require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

const userSessions = new Map();

client.once("ready", () => {
    console.log(`🤖 Bot is ready: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith("/ask")) {
        const question = message.content.replace("/ask", "").trim();
        await message.channel.sendTyping();

        try {
            const res = await axios.post("http://localhost:8000/query", {
                user_id: message.author.id,
                question: question,
            });

            const reply = await message.reply(`📘 **Answer:** ${res.data.answer}`);
            await reply.react("👍");
            await reply.react("👎");

            userSessions.set(message.author.id, {
                question: question,
                response: res.data.answer,
                botMessageId: reply.id,
                rating: "",
                comment: "",
                submitted: false
            });
        } catch (err) {
            console.error(err);
            await message.reply("⚠️ Sorry, there was an error processing your request.");
        }
    }

    if (message.content.startsWith("/feedback")) {
        const comment = message.content.replace("/feedback", "").trim();
        const session = userSessions.get(message.author.id);

        if (!session) {
            return await message.reply("⚠️ No recent question to attach feedback to.");
        }

        session.comment = comment;

        await submitFeedback(message.author.id, session);
        userSessions.delete(message.author.id);
        await message.reply("✅ Feedback submitted!");
    }
});

client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const session = userSessions.get(user.id);
    if (!session || reaction.message.id !== session.botMessageId) return;

    const emoji = reaction.emoji.name;
    const rating = emoji === "👍" ? "thumbs_up" : emoji === "👎" ? "thumbs_down" : null;
    if (!rating) return;

    session.rating = rating;

    await submitFeedback(user.id, session);
    userSessions.delete(user.id);
    await reaction.message.reply(`✅ Feedback from <@${user.id}> submitted!`);
});

async function submitFeedback(userId, session) {
    if (session.submitted) return;
    session.submitted = true;

    try {
        const res = await axios.post("http://localhost:8000/feedback", {
            question: session.question || "",
            response: session.response || "",
            rating: session.rating || "",
            comment: session.comment || "",
            timestamp: new Date().toISOString()
        });
        console.log(`✅ Feedback submitted for ${userId}`, res.data);
    } catch (err) {
        console.error("❌ Failed to submit feedback:", err.response?.data || err.message);
    }
}

client.login(process.env.DISCORD_TOKEN);

