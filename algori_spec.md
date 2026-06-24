# 算法与常数规格（Algorithm Specification）

> 本文档描述 `index.html` 单页模拟器中**实际运行的算法与固定常数**。  
> **不包含**用户开局自由输入项（年收入、年盈余、住房面积、常住人口、年取暖费用等）及其推荐默认值。

实现源码位置：根目录 `index.html` 内联 `<script>`（常量约 L621–647，回合逻辑约 L1072–1379）。

---

## 1. 模拟流程总览

| 回合 | 名称 | 核心算法触发 |
|------|------|----------------|
| 开局 | 建档 | 排放基准建立、指标初始化 |
| 1 | 现状抉择 | 合规度赋值；分支进入回合 2 或跳过至回合 3 |
| 2 | 合规压力（可选） | 执法概率模型；整改扣款 |
| 3 | 技术路线 | 改造成本与年取暖费按面积缩放；盈余调整；排放重算 |
| 4 | 增收/降耗 | 收入 +20% 或取暖费 ×60%；排放重算（节能路径） |
| 5 | 补贴退坡 | 气价补贴减少冲击；终局判定 |

固定设定（非用户输入）：游戏角色 = 农民家庭；地区 = 保定；初始取暖方式 = 散煤炉。

---

## 2. 核心指标与通用公式

### 2.1 六项核心指标

| 指标 | 符号/字段 | 说明 |
|------|-----------|------|
| 当前取暖年花费 | `heatingCost` | 元/年，随改造、节能、补贴冲击变化 |
| 年收入 | `income` | 元/年，回合 4 副业可 +20% |
| 年盈余 | `surplus` | 元/年，现金流缓冲 |
| 法律合规度 | `compliance` | 0–100 分 |
| 排放达标度 | `emission` | 0–100 分（散煤路线恒为 0） |
| 能耗负担率 | — | 取暖年花费占年收入百分比 |

### 2.2 能耗负担率

```
能耗负担率 (%) = heatingCost / max(1, income) × 100
```

### 2.3 住房面积缩放（100㎡ 基准户）

所有「每 100㎡」基准造价/运行费均按农户住房面积线性缩放：

```
scale(area, basePer100Sqm) = round(basePer100Sqm × area / 100)
```

---

## 3. 经济类常数

### 3.1 散煤价格（用于用量反推与补贴换算）

| 常数 | 值 | 单位 | 用途 |
|------|-----|------|------|
| `SCATTERED_COAL_PRICE_PER_TON` | **1000** | 元/吨 | 由年取暖费反推散煤吨数；回合 5 气量换算 |

```
散煤吨数 coalTons = initialHeatingCost / 1000
```

### 3.2 技术路线一次性改造费（100㎡ 基准）

| 选项 ID | 路线 | `BASE_RENOVATION_COST_PER_100SQM` |
|---------|------|-----------------------------------|
| A | 天然气 | **3000** 元 |
| B | 地源热泵 | **10000** 元 |
| C | 空气源热泵 | **7000** 元 |

实际改造投入：

```
invest = round(BASE_RENOVATION_COST_PER_100SQM[id] × area / 100)
```

**准入条件（回合 3）**：`income > invest`，否则禁止选择该路线。

### 3.3 技术路线改造后年取暖费（100㎡ 基准）

| 选项 ID | 路线 | `BASE_ANNUAL_HEATING_COST_PER_100SQM` |
|---------|------|---------------------------------------|
| A | 天然气 | **8000** 元/年 |
| B | 地源热泵 | **2000** 元/年 |
| C | 空气源热泵 | **4300** 元/年 |

实际年取暖费：

```
newHeatingCost = round(BASE_ANNUAL_HEATING_COST_PER_100SQM[id] × area / 100)
```

### 3.4 回合 3 盈余变化

设改造前年取暖费为 `originalHeatingCost`（即开局散煤年取暖费，全程保存在 `initialHeatingCost`）：

```
surplusDelta = newHeatingCost + invest - originalHeatingCost
surplus ← surplus - surplusDelta
heatingCost ← newHeatingCost
```

（等价于：一次性扣除改造费，并将年取暖费从散煤水平切换为清洁路线水平。）

### 3.5 回合 2 整改申请扣款

```
surplus ← surplus - 800    （固定 800 元，与面积无关）
compliance ← 50
```

### 3.6 回合 4 策略

**A · 副业增收**

```
incomeBoost = round(income × 0.2)
income ← income + incomeBoost
surplus ← surplus + incomeBoost
```

排放达标度与 CO₂ **不变**（不调用排放重算）。

**B · 强力节能**

```
newHeatingCost = round(heatingCost × 0.6)
surplus ← surplus + |newHeatingCost - heatingCost|
heatingCost ← newHeatingCost
isEnergySaving ← true
```

随后调用排放模型重算（见 §5.4 节能系数）。

### 3.7 回合 5 补贴退坡

| 常数 | 值 | 说明 |
|------|-----|------|
| `GAS_M3_PER_COAL_TON` | **250** | 1 吨散煤等价天然气立方米数 |
| `SUBSIDY_REDUCTION_PER_M3` | **0.6** | 元/m³，补贴退坡导致的用气成本上升 |

```
coalTons = initialHeatingCost / 1000
gasVolume = coalTons × 250
rise = round(gasVolume × 0.6)
heatingCost ← heatingCost + rise
```

**说明**：回合 5 仅增加取暖年花费，**不**再次调用 `updateEmissionFromModel()`，故排放达标度与 CO₂ 吨数保持回合 4 结束时的值（相当于「排放侧冻结」）。

---

## 4. 法律合规度算法

合规度为**离散赋值 + 概率执法**，无连续微分公式。

### 4.1 各回合合规度变化

| 事件 | compliance |
|------|------------|
| 开局（散煤） | 0 |
| 回合 1 · 继续散煤 (A) | 0 |
| 回合 1 · 准备转型 (B) | 60 |
| 回合 2 · 继续违规 (1) | 0 |
| 回合 2 · 申请整改 (2) | 50 |
| 回合 3 · 完成清洁改造 | **100** |
| 回合 4 · 任意策略 | **100**（维持） |

连续拒绝整改计数 `nonRectifyStreak`：回合 1 选 A 置 1；回合 2 选 1 则 +1；选 2 或回合 1 选 B 则置 0。

### 4.2 执法概率模型（回合 2 循环）

基于住房面积 `area`（㎡）：

```
BP（基础处罚强度）= 40 + (area / 100) × 15

p（单次巡查逃脱率）= 1 - BP / 100

P_seized（连续 n 次违规后累计被处罚概率）= 1 - p^n
```

其中 `n = nonRectifyStreak`。

**触发条件**：

1. `nonRectifyStreak >= 2`
2. `compliance < seized_compliance_threshold`（固定 **30**）
3. 掷均匀随机数 `roll ~ U(0,1)`，若 `roll < P_seized` → 终局 **被处罚**

### 4.3 被处罚阈值

| 参数 | 固定值 |
|------|--------|
| `seized_compliance_threshold` | **30**（合规度低于此值才可能被概率执法命中） |

---

## 5. 排放与碳排放算法

能量单位统一为 **GJ**；1 TJ = 1000 GJ。燃煤、天然气 CO₂ 排放因子采用**国标附表**「单位热值 CO₂ 排放因子」（tCO₂/TJ），已含碳氧化率。

### 5.1 物理常数

| 常数 | 值 | 单位 | 含义 |
|------|-----|------|------|
| `COAL_ENERGY_GJ_PER_TON` | 23.2 | GJ/吨 | 散煤输入能量 |
| `COAL_USEFUL_HEAT_GJ_PER_TON` | 9 | GJ/吨 | 散煤有效供热（热泵电需求基准） |
| `COAL_C_INTENSITY_TC_PER_TJ` | **26.1** | tC/TJ | 燃煤单位热值含碳量（国标附表） |
| `COAL_C_OXIDATION_RATE` | **0.93** | — | 燃煤碳氧化率 93% |
| `COAL_CO2_INTENSITY_TCO2_PER_TJ` | **89.0** | tCO₂/TJ | 燃煤单位热值 CO₂ 排放因子 |
| `GAS_ENERGY_GJ_PER_M3` | 0.036 | GJ/m³ | 天然气能量密度 |
| `GAS_C_INTENSITY_TC_PER_TJ` | **15.3** | tC/TJ | 天然气单位热值含碳量（国标附表） |
| `GAS_C_OXIDATION_RATE` | **0.99** | — | 天然气碳氧化率 99% |
| `GAS_CO2_INTENSITY_TCO2_PER_TJ` | **55.54** | tCO₂/TJ | 天然气单位热值 CO₂ 排放因子 |
| `GSHP_HEAT_GJ_PER_KWH` | 0.0144 | GJ/kWh | 地源热泵产热系数 |
| `ASHP_HEAT_GJ_PER_KWH` | 0.0106 | GJ/kWh | 空气源热泵产热系数 |
| `GRID_EMISSION_KGCO2_PER_KWH` | 0.6361 | kgCO₂/kWh | 华北电网排放因子 |

国标关系：`tCO₂/TJ = tC/TJ × 碳氧化率 × (44/12)`（燃煤 26.1×0.93×44/12≈89.0；天然气 15.3×0.99×44/12≈55.54）。

### 5.2 排放基准（开局由散煤年取暖费建立）

```
coalTons = initialHeatingCost / 1000

initialCoalInputEnergyGJ = coalTons × 23.2

requiredUsefulEnergyGJ = coalTons × 9

E_initial (吨 CO₂) = (initialCoalInputEnergyGJ / 1000) × 89.0
```

基准对象保存在 `emissionBaseline`，全程不变。

### 5.3 当前路线 CO₂ 排放量 `E_current`

节能标志 `isEnergySaving` 时，`energyMultiplier = 0.6`，否则为 `1.0`。

**散煤炉**

```
E_current = E_initial × energyMultiplier
排放达标度 = 0
```

**天然气**

```
gasVolume = coalTons × 250 × energyMultiplier
gasEnergyGJ = gasVolume × 0.036
E_current = (gasEnergyGJ / 1000) × 55.54
```

**地源热泵**

```
gshpElectricityKwh = (requiredUsefulEnergyGJ × energyMultiplier) / 0.0144
E_current = gshpElectricityKwh × 0.6361 × 0.001   （吨 CO₂）
```

**空气源热泵**

```
ashpElectricityKwh = (requiredUsefulEnergyGJ × energyMultiplier) / 0.0106
E_current = ashpElectricityKwh × 0.6361 × 0.001   （吨 CO₂）
```

界面展示 `co2Tons = E_current`（保留 3 位小数）。

### 5.4 排放达标度评分（清洁路线）

```
若 heatingMethod === "散煤炉"：
    emission = 0
否则：
    emission = clamp( round((1 - E_current / E_initial) × 100), 0, 100 )
```

含义：相对散煤基准的减排率映射为 0–100 分；100 分表示相对基准完全减排。

---

## 6. 结局判定

### 6.1 固定阈值（页面隐藏字段，不可由用户修改）

| 参数 | 值 | 用途 |
|------|-----|------|
| `bankrupt_energy_burden_threshold` | **10** % | 早期/负担判定参考 |
| `seized_compliance_threshold` | **30** | 执法模型门槛 |
| `success_emission_threshold` | **75** | 成功：排放达标度下限 |
| `success_compliance_min` | **100** | 成功：合规度须满分 |
| `success_energy_burden_max` | **10** % | 成功：能耗负担率上限 |
| `success_surplus_min` | **0** 元 | 成功：年盈余下限 |

### 6.2 中途经济破产（`evaluateEarlyEnding`）

在回合 1–4 每次选择后检测：

```
若 能耗负担率 > 10% 且 surplus <= 0：
    终局 = 经济破产
```

### 6.3 被处罚（`tryProbabilisticSeizedEnforcement`）

见 §4.2；终局类型 `seized`。

### 6.4 回合 5 终局（`finalRoundSettle`）

设 `burden = 能耗负担率`：

**成功转型**（须同时满足）：

```
emission >= 75
compliance >= 100
burden <= 10%
surplus >= 0
```

**经济破产**（否则）：

- 若 `surplus < 0` → 文案：「回合5结束后年盈余为负…」
- 其余未达成功条件 → 文案：「回合5发生补贴减少后，家庭未达到成功条件…」

---

## 7. 辅助函数

```
clamp(v, min, max) = max(min, max(v, min))
```

---

## 8. 未纳入本模拟器的算法

以下参数存在于 `research/data/calibration_defaults.json` 等研究资料中，但**当前网站运行时未直接调用**：

- 分档气价（2.98 / 3.18 元/m³）、阶梯气量、分年运营补贴表
- 设备购置补贴封顶（1350 / 3700 元等）
- 河北 HHB 5.4% 官方负担线（模拟器成功/破产阈值取 **10%**）
- 返煤率、PM2.5、供暖度日等环境统计

若未来版本接入，应在本文件追加版本号与变更记录。

---

## 9. 文档维护

| 项目 | 说明 |
|------|------|
| 对应代码 | `index.html` |
| 校准参考 | `research/data/calibration_defaults.json`（研究用，非运行时绑定） |
| 产品说明 | `spec.md` |
| 更新时机 | 修改 `index.html` 内常量或回合公式时同步更新本文档 |
