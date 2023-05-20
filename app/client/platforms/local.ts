import { REQUEST_TIMEOUT_MS } from "@/app/constant";
import { useAccessStore, useAppConfig, useChatStore } from "@/app/store";

import { ChatOptions, getHeaders, LLMApi, LLMUsage } from "../api";
import Locale from "../../locales";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import { prettyObject } from "@/app/utils/format";

export class LocalApi implements LLMApi {
  public ChatPath = "v1/chat/completions";
  public UsagePath = "dashboard/billing/usage";
  public SubsPath = "dashboard/billing/subscription";

  path(path: string): string {
      const protocol = window.location.protocol.includes('https') ? 'wss': 'ws'
      return `${protocol}://${location.hostname}:8000/${path}`;
  }

  extractMessage(res: any) {
    return res.choices?.at(0)?.message?.content ?? "";
  }

  async chat(options: ChatOptions) {
    const messages = options.messages;

    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
      },
    };

    const requestPayload = messages;

    console.log("[Request] openai payload: ", requestPayload);

    const shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);

    try {
      const chatPath = this.path("chat");
      
      // if (shouldStream) {
      let responseText = "";
      let finished = false;

      const finish = () => {
        if (!finished) {
          options.onFinish(responseText);
          finished = true;
        }
      };
      // },
      // Create a WebSocket connection
      const socket = new WebSocket(chatPath);

      // Handle WebSocket events
      socket.onopen = () => {
        console.log("Socket opened")
        // Send the request payload as a JSON string
        socket.send(JSON.stringify(requestPayload));
      };

      socket.onmessage = (event) => {
        const resJson = JSON.parse(event.data);
        if (resJson.type === "end" || finished) {
          return finish();
        }
        if (resJson.type === "stream" && resJson.sender === "bot") {
          const text = resJson.message;
          try {
            responseText += text;
            options.onUpdate?.(responseText, text);
          } catch (e) {
            console.error("[Request] parse error", text, event);
          }
        }
        // options.onFinish(resJson);
        // socket.close(); // Close the WebSocket connection
      };

      socket.onerror = (error) => {
        console.log("[WebSocket] error:", error);
        // options.onError?.(error);
        socket.close(); // Close the WebSocket connection
      };

      socket.onclose = () => {
        console.log("[WebSocket] connection closed");
        socket.close(); // Close the WebSocket connection
      };
    } catch (e) {
      console.log("[Request] failed to make a chat request", e);
      options.onError?.(e as Error);
    }
  }
  async usage() {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
        .getDate()
        .toString()
        .padStart(2, "0")}`;
    const ONE_DAY = 1 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = formatDate(startOfMonth);
    const endDate = formatDate(new Date(Date.now() + ONE_DAY));

    const [used, subs] = await Promise.all([
      fetch(
        this.path(
          `${this.UsagePath}?start_date=${startDate}&end_date=${endDate}`,
        ),
        {
          method: "GET",
          headers: getHeaders(),
        },
      ),
      fetch(this.path(this.SubsPath), {
        method: "GET",
        headers: getHeaders(),
      }),
    ]);

    if (used.status === 401) {
      throw new Error(Locale.Error.Unauthorized);
    }

    if (!used.ok || !subs.ok) {
      throw new Error("Failed to query usage from openai");
    }

    const response = (await used.json()) as {
      total_usage?: number;
      error?: {
        type: string;
        message: string;
      };
    };

    const total = (await subs.json()) as {
      hard_limit_usd?: number;
    };

    if (response.error && response.error.type) {
      throw Error(response.error.message);
    }

    if (response.total_usage) {
      response.total_usage = Math.round(response.total_usage) / 100;
    }

    if (total.hard_limit_usd) {
      total.hard_limit_usd = Math.round(total.hard_limit_usd * 100) / 100;
    }

    return {
      used: response.total_usage,
      total: total.hard_limit_usd,
    } as LLMUsage;
  }
}
