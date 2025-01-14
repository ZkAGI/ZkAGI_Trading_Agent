# ZkAGI AiFi Trading Agent 

ZkAGI AiFi Trading Agent is a autonomously executing Python-based agent that fetches Bitcoin market analysis data, analyzes it using a time series transformer inside the ZkAGI network, and executes a swap if the signal is "buy". Trading execution is being done on a TEE machine where the agents wallet is stored and the user cross verifies whether an action is to be taken based on 'buy' signals emanating from the predictions of the time series transformer.


Watch a video demonstration of the ZkAGI AiFi Trading Agent in action:
[![Watch the video]](https://drive.google.com/file/d/1SIK_ZhYUQIZcpi5Grhrnl7XMOjsuf7GR/view?usp=drive_link)


## Features

- Fetches Bitcoin market analysis data
- Analyzes the data using ZkAGI Zynapse API embedded with Nixtla Time series transformer.
- Executes a swap using wallet in TEE if the signal is "buy".
- User authenticates actions using Tg double check.

## Requirements

- Python 3.x
- `requests` library
- `Zynapse API` key
- `python-dotenv` library
- `colorama` library

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/ZkAGI/ZkAGI_Trading_Agent.git
    cd ZkAGI_Trading_Agent
    ```

2. Install the required libraries:
    ```sh
    pip install -r requirements.txt
    ```

3. Create a `.env` file in the project directory with the following content:
    ```
    ZKAGI_API_KEY=your_zkagi_api_key
    ZKAGI_API_URL=https://zynapse.zkagi.ai/v1
    ANALYSIS_API_URL=
    SWAP_API_URL=
    TELEGRAM_ID=your_telegram_id
    OUTPUT_MINT=your_output_mint
    ```

## Usage

1. Run the agent:
    ```sh
    python agent.py
    ```
2. If you want to use ZK Enabled Agent, run:
    ```sh
    python agent_with_ZK.py
    ```
3. The agent will start, fetch the analysis data, analyze it, and execute a swap if the signal is "buy". The output will be colorful and formatted for better readability.

## Output

The script will print the following steps with the appropriate colors and symbols:

1. `Agent started ✅`
2. `Fetching analysis data...`
3. `Analysis Data Received:` followed by the signal.
4. `Signal is: buy ✅` or `Signal is: hold ❌` depending on the signal.
5. `Analyzing response...`
6. `Analysis Result:` followed by the detailed analysis result from the OpenAI API.
7. If the signal is "buy", it will print `Executing swap...`, `Swap started ✅`, and `Swap executed successfully ✅` or `Failed to execute swap: {status_code} ❌` depending on the swap result.


---


