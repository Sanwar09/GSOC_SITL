import requests
try:
    res = requests.get('https://api.coindesk.com/v1/bpi/currentprice.json', timeout=5)
    data = res.json()
    print(f'Current Price: ${data['bpi']['USD']['rate']}')
except Exception as e:
    print(f'Could not check price. Error: {e}')