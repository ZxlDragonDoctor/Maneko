import asyncio
import os

from agentscope.agent import Agent
from agentscope.credential import DashScopeCredential
from agentscope.event import EventType
from agentscope.message import UserMsg
from agentscope.model import DashScopeChatModel
from agentscope.tool import Toolkit, Bash, Read, Write, Edit


async def main() -> None:
    agent = Agent(
        name="Friday",
        system_prompt="You are a helpful assistant named Friday.",
        model=DashScopeChatModel(
            credential=DashScopeCredential(
                api_key=os.environ.get("DASHSCOPE_API_KEY", ""),
            ),
            model="qwen3.8-max",
        ),
        toolkit=Toolkit(tools=[Bash(), Read(), Write(), Edit()]),
    )

    user_msg = UserMsg(name="user", content="Hello, who are you?")

    # 方式一：等待最终的助手消息。
    reply_msg = await agent.reply(user_msg)
    # `reply_msg` 是一个 `AssistantMsg`，其 `content` 是一组内容块。
    # 可按需检查文本块、工具调用等。
    ...
    
    print(reply_msg.content)
    print(reply_msg.get_text_content())
    # # 方式二：流式获取增量事件（文本片段、工具调用等）。
    # async for event in agent.reply_stream(user_msg):
    #     # 根据 `event.type` 分发处理 —— 每个分支对应一种事件类型。
    #     match event.type:
    #         case EventType.TEXT_BLOCK_DELTA:
    #             # 模型返回的流式文本片段 —— 追加到界面或标准输出。
    #             ...
    #         case EventType.TOOL_CALL_START:
    #             # 智能体即将调用工具 —— 展示调用信息。
    #             ...
    #         case _:
    #             # 其他事件：思考块、工具结果、回复结束等。
    #             ...


asyncio.run(main())

