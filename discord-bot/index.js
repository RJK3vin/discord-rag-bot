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

    if (message.content.trim() === "/help") {
        return await message.reply({
            content: `
📘 **Welcome to RAG Bot!**

Here's what I can help you with:

🧠 **Capabilities**
• Answer questions about your AI Bootcamp:
  - Internship schedule
  - Team matching
  - Technical topics (LLMs, RAG, MLOps)
  - Tools (LangChain, FastAPI, Docker, etc.)
• Summarize internal documentation
• Collect feedback with 👍 / 👎 and comments

🚫 **Limitations**
• I can't access real-time web data
• I only answer based on the official bootcamp documents

💬 **How to Use**
• Ask a question: \`/ask What happens in Week 4?\`
• Leave feedback: \`/feedback This helped a lot!\`
• Use 👍 / 👎 to rate answers

Need ideas? Try \`/examples\`
        `.trim()
        });
    }

    if (message.content.trim() === "/examples") {
        return await message.reply({
            content: `
📌 **Example Questions You Can Ask**

🗓️ Bootcamp Timeline
• /ask What should I do in Week 1?
• /ask When is Pitch Day?

👥 Team Matching
• /ask How do I get matched to a team?
• /ask What is a Lead Engineer's role?

🤖 AI Concepts
• /ask What is RAG in AI?
• /ask How do transformers work?
• /ask What is the difference between supervised and unsupervised learning?

🧰 Tools & Frameworks
• /ask What does FastAPI do?
• /ask How do I use LangChain?

Type your own question using /ask anytime!
        `.trim()
        });
    }

    if (message.content.startsWith("/ask")) {
        const question = message.content.replace("/ask", "").trim();
        await message.channel.sendTyping()

        let typing = true
        const typingInterval = setInterval(() => {
            if (typing) {
                message.channel.sendTyping().catch(console.error)
            }
        }, 5000)

        try {
            const res = await axios.post("http://localhost:8000/query", {
                user_id: message.author.id,
                question: question,
            });

            typing = false
            clearInterval(typingInterval)

            let answer = res.data.answer.trim()

            if (answer.toLowerCase().startsWith("answer:")) {
                answer = answer.slice(7).trim()
            }

            const reply = await message.reply(`📘 **Answer:** ${answer}`);
            await reply.react("👍");
            await reply.react("👎");

            userSessions.set(message.author.id, {
                question: question,
                response: res.data.answer,
                botMessageId: reply.id,
                rating: "",
                comment: "",
                submitted: false,
                submissionTimer: null
            });
        } catch (err) {
            typing = false
            clearInterval(typingInterval)
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

        if (session.submitted) {
            return await message.reply("⚠️ Feedback already submitted for this question.");
        }

        session.comment = comment;

        if (session.submissionTimer) {
            clearTimeout(session.submissionTimer);
        }

        scheduleSubmission(message.author.id, session);
        await message.reply("✅ Comment added to feedback!");
    }
});

client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const session = userSessions.get(user.id);
    if (!session || reaction.message.id !== session.botMessageId) return;

    if (session.submitted) {
        return;
    }

    const emoji = reaction.emoji.name;
    const rating = emoji === "👍" ? "thumbs_up" : emoji === "👎" ? "thumbs_down" : null;

    if (!rating) return;

    session.rating = rating;

    if (session.submissionTimer) {
        clearTimeout(session.submissionTimer);
    }

    scheduleSubmission(user.id, session);
    await reaction.message.reply(`✅ Rating from <@${user.id}> recorded!`);
});

function scheduleSubmission(userId, session) {

    session.submissionTimer = setTimeout(async () => {
        await submitFeedback(userId, session);
    }, 10000);
}

async function submitFeedback(userId, session) {
    if (session.submitted) return;

    session.submitted = true;

    if (session.submissionTimer) {
        clearTimeout(session.submissionTimer);
        session.submissionTimer = null;
    }

    try {
        const res = await axios.post("http://localhost:8000/feedback", {
            question: session.question || "",
            response: session.response || "",
            rating: session.rating || "",
            comment: session.comment || "",
            timestamp: new Date().toISOString()
        });

        console.log(`✅ Feedback submitted for ${userId}`, res.data);

        userSessions.delete(userId);

        console.log(`✅ Feedback successfully submitted for user ${userId}`)

    } catch (err) {
        console.error("❌ Failed to submit feedback:", err.response?.data || err.message);

        session.submitted = false;
    }
}

client.login(process.env.DISCORD_TOKEN);
