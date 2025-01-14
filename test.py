import requests
import time
from dotenv import load_dotenv
import os
from colorama import Fore, Style, init

# Initialize colorama
init(autoreset=True)

# Load environment variables from .env file
load_dotenv()

class TradingAgent:
    def __init__(self):
        self.analysis_api_url = os.getenv("ANALYSIS_API_URL")
        self.swap_api_url = os.getenv("SWAP_API_URL")
        self.telegram_id = os.getenv("TELEGRAM_ID")
        self.output_mint = os.getenv("OUTPUT_MINT")
        self.zkagi_api_url = os.getenv("ZKAGI_API_URL")
        self.zkagi_api_key = os.getenv("ZKAGI_API_KEY")

    def fetch_analysis(self):
        print(Fore.GREEN + Style.BRIGHT + "Agent started ✅")
        response = requests.get(self.analysis_api_url)
        if response.status_code == 200:
            analysis_data = response.json()
            return analysis_data
        else:
            print(Fore.RED + Style.BRIGHT + f"Failed to fetch analysis data: {response.status_code} ❌")
            return None

    def analyze_response(self, analysis_data):
        latest_date = analysis_data.get("latest_date", "N/A")
        latest_price = analysis_data.get("latest_price", "N/A")
        next_day_prediction = analysis_data.get("next_day_prediction", {})
        signal = analysis_data.get("signal", "N/A")

        prompt = f"""
        Analyze the following Bitcoin market data and provide a recommendation:

        Latest Date: {latest_date}
        Latest Price: {latest_price}

        Next Day Prediction:
        - TimeGPT: {next_day_prediction.get("TimeGPT", "N/A")}
        - TimeGPT-hi-50: {next_day_prediction.get("TimeGPT-hi-50", "N/A")}
        - TimeGPT-hi-80: {next_day_prediction.get("TimeGPT-hi-80", "N/A")}
        - TimeGPT-hi-90: {next_day_prediction.get("TimeGPT-hi-90", "N/A")}
        - TimeGPT-lo-50: {next_day_prediction.get("TimeGPT-lo-50", "N/A")}
        - TimeGPT-lo-80: {next_day_prediction.get("TimeGPT-lo-80", "N/A")}
        - TimeGPT-lo-90: {next_day_prediction.get("TimeGPT-lo-90", "N/A")}
        - Date: {next_day_prediction.get("ds", "N/A")}

        Signal: {signal}

        Provide a detailed analysis of the pricing differentiation and recommend whether to buy, sell, or hold based on the given data.
        """
        start_time = time.time()

        headers = {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.zkagi_api_key}'
        }
        data = {
            "model": "mistral-large-latest",
            "messages": [{"role": "user", "content": prompt}],
            "zk_proof": True
        }

        response = requests.post(self.zkagi_api_url, headers=headers, json=data)
        end_time = time.time()

        if response.status_code == 200:
            print(Fore.GREEN + Style.BRIGHT + f"Analysis Time= {end_time - start_time:.2f} seconds")
            return response.json()['choices'][0]['message']
        else:
            print(Fore.RED + Style.BRIGHT + f"Failed to analyze response: {response.status_code} ❌")
            return None

    def execute_swap(self):
        headers = {
            'accept': 'application/json',
            'Content-Type': 'application/json'
        }
        data = {
            "telegramId": self.telegram_id,
            "outputMint": self.output_mint
        }
        print(Fore.GREEN + Style.BRIGHT + "Swap started ✅")
        response = requests.post(self.swap_api_url, headers=headers, json=data)
        if response.status_code == 200:
            print(Fore.GREEN + Style.BRIGHT + "Swap executed successfully ✅")
        else:
            print(Fore.RED + Style.BRIGHT + f"Failed to execute swap: {response.status_code} ❌")
        return response.json()

    def run(self):
        print(Fore.CYAN + Style.BRIGHT + "Fetching analysis data...")
        analysis_data = self.fetch_analysis()
        if analysis_data:
            signal = analysis_data.get("signal", "No signal")
            print("\n" + Fore.CYAN + Style.BRIGHT + "Analysis Data Received:")
            print(Fore.CYAN + Style.BRIGHT + f"Signal: {signal}")

            if signal.lower() == "buy":
                print(Fore.GREEN + Style.BRIGHT + f"Signal is: {signal} ✅")
            elif signal.lower() == "hold":
                print(Fore.RED + Style.BRIGHT + f"Signal is: {signal} ❌")
            else:
                print(Fore.YELLOW + Style.BRIGHT + f"Signal is: {signal}")

            print(Fore.CYAN + Style.BRIGHT + "\nAnalyzing response...")
            analysis_result = self.analyze_response(analysis_data)
            print(Fore.CYAN + Style.BRIGHT + "\nAnalysis Result:")
            print(analysis_result['content'])

            if signal.lower() == "buy":
                print(Fore.CYAN + Style.BRIGHT + "\nExecuting swap...")
                swap_result = self.execute_swap()
                print(Fore.CYAN + Style.BRIGHT + "Swap Result:")
                print(swap_result)

# Example usage
if __name__ == "__main__":
    agent = TradingAgent()
    agent.run()
