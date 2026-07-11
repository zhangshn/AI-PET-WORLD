# World Samples 样本目录

本目录只保存经过协议记录的训练样本和待处理样本决策。

```txt
data/world-samples/
  positive/
  negative/
  rejected/
  pending/
```

规则：

```txt
positive 只放人工复核通过并允许训练的正样本。
negative 只放人工复核失败但有训练价值的负样本。
rejected 放失败且暂不进入训练的数据。
pending 放还没有真实图片、没有复核结论或还不能训练的候选。
```

训练边界：

```txt
generated + generated_by_us + positive/negative 可以进入训练。
pending_review 不可以进入训练。
reference_only 不可以直接进入训练。
external_reference + unknown 不可以训练。
external_reference + do_not_train 不可以训练。
```
