import express from "express";
import { Bot, Events, Message } from "viber-bot";

async function start() {
  const register = await fetch(`${process.env.MCP_HUB_URL}/servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tools: [
        {
          name: "echo",
          description: "Echo back provided text",
          inputSchema: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
          },
        },
      ],
    }),
  });
  const { call } = await register.json();

  const bot = new Bot({
    authToken: process.env.VIBER_TOKEN!,
    name: "MCP Bot",
    avatar: "",
  });

  bot.on(Events.MESSAGE_RECEIVED, async (message: any, response: any) => {
    const callRes = await fetch(`${process.env.MCP_HUB_URL}${call}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "echo", input: { text: message.text } }),
    });
    const data = await callRes.json();
    response.send(new Message.Text(data.result));
  });

  const app = express();
  app.use("/viber/webhook", bot.middleware());
  app.listen(process.env.PORT || 3000, () => {
    console.log("Viber bot listening");
  });
}

start().catch(console.error);
