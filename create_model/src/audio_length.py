import pickle

with open("training_data.pkl", "rb") as f:
    data = pickle.load(f)

print(type(data))        # <class 'pandas.core.frame.DataFrame'>
print(len(data))         # 行数
print(data.iloc[0])      # 最初の行の内容
print(data.columns)      # 列名の確認
