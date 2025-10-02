import pickle
import json
import sys
import numpy as np

def convert_to_serializable(obj):
    if isinstance(obj, np.ndarray):
        return obj.tolist()  # ndarray → list
    elif isinstance(obj, (bytes, bytearray)):
        return obj.decode('utf-8', errors='ignore')  # バイナリ → 文字列（必要なら）
    elif isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_serializable(i) for i in obj]
    else:
        return obj
    
def main(args):
  path = args[0]
  
  with open(path, 'rb') as f:
    data = pickle.load(f)
  
  serializable_data = convert_to_serializable(data)
  
  print(json.dumps(serializable_data, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1:])