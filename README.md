# TradingAgent

TradingAgent is a Python-based agent that fetches Bitcoin market analysis data, analyzes it using OpenAI, and executes a swap if the signal is "buy". The agent uses environment variables for configuration and provides a colorful, formatted output for better presentation. Trading execution is being done on a TEE machine.

## Features

- Fetches Bitcoin market analysis data from a specified API.
- Analyzes the data using OpenAI's language model.
- Executes a swap if the signal is "buy".
- Provides a colorful and formatted output for better readability.
- Uses environment variables for configuration.

## Requirements

- Python 3.x
- `requests` library
- `openai` library
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
    python trading_agent.py
    ```

2. The agent will start, fetch the analysis data, analyze it, and execute a swap if the signal is "buy". The output will be colorful and formatted for better readability.

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


