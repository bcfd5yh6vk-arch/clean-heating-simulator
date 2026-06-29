# 算法与常数规格（Algorithm Specification）

> 本文档描述单页模拟器中**实际运行的算法与固定常数**。  
> **不包含**用户开局自由输入项（年收入、年盈余、住房面积、常住人口、年取暖费用等）及其推荐默认值。

## 0. 运行时配置（网页自动同步）

**修改下方 `simulation-config` 代码块中的数值，保存本文件后刷新网站即可同步到 `index.html` 模拟器**（页面启动时 `fetch('algori_spec.md')` 解析该块）。公式说明见下文各节；回合流程逻辑仍在 `index.html` 中实现。

```simulation-config
{
  "version": 1,
  "economy": {
    "scatteredCoalPricePerTon": 1000,
    "gasM3PerCoalTon": 250,
    "gasPricePerM3": 2.98,
    "electricityPricePerKwh": 0.5,
    "subsidyReductionPerM3": 0.6,
    "rectifyApplicationCost": 800,
    "sideIncomeBoostRatio": 0.2,
    "energySavingHeatingCostRatio": 0.6,
    "energySavingEmissionMultiplier": 0.6,
    "insulationCostPer100Sqm": 1000,
    "insulationDemandFactor": 0.625,
    "baseRenovationCostPer100Sqm": { "A": 3000, "B": 10000, "C": 7000 }
  },
  "compliance": {
    "turn1ContinueCoal": 0,
    "turn1PrepareTransition": 60,
    "turn2ContinueViolation": 0,
    "turn2ApplyRectify": 50,
    "afterCleanRenovation": 100,
    "enforcementMinStreak": 2,
    "bpBase": 40,
    "bpPer100Sqm": 15
  },
  "emission": {
    "coalEnergyGjPerTon": 23.2,
    "coalCo2IntensityTco2PerTj": 89.0,
    "gasEnergyGjPerM3": 0.036,
    "gasCo2IntensityTco2PerTj": 55.54,
    "gshpHeatGjPerKwh": 0.0144,
    "ashpHeatGjPerKwh": 0.0106,
    "gridEmissionKgco2PerKwh": 0.6361,
    "perCapitaBaselineTons": 1.0,
    "scoreSlope": 20,
    "defaultPopulation": 4
  },
  "thresholds": {
    "bankruptEnergyBurdenPct": 10,
    "seizedCompliance": 30,
    "successEmission": 80,
    "successComplianceMin": 100,
    "successEnergyBurdenMax": 10,
    "successSurplusMin": 0
  },
  "techRoutes": {
    "A": "天然气",
    "B": "地源热泵",
    "C": "空气源热泵"
  }
}
```

实现源码：`index.html` 内联脚本在页面加载时读取上表；回合逻辑约 L1100+。

---

## 1. 模拟流程总览

| 回合 | 名称 | 核心算法触发 |
|------|------|----------------|
| 开局 | 建档 | 排放基准建立、指标初始化 |
| 1 | 现状抉择 | 合规度赋值；分支进入回合 2 或跳过至回合 3 |
| 2 | 合规压力（可选） | 执法概率模型；整改扣款 |
| 3 | 技术路线 | 改造成本按面积缩放；改造后取暖费由初始散煤用量换算气量/电量 × 价格 |
| 4 | 增收/降耗 | 提高收入、节约取暖或保暖修缮（三选一） |
| 5 | 补贴退坡 | 气价补贴减少冲击；终局判定 |

固定设定（非用户输入）：游戏角色 = 农民家庭；地区 = 河北；初始取暖方式 = 散煤炉。

---

## 2. 核心指标与通用公式

### 2.1 六项核心指标

| 指标 | 符号/字段 | 说明 |
|------|-----------|------|
| 当前取暖年花费 | `heatingCost` | 元/年，随改造、节能、补贴冲击变化 |
| 年收入 | `income` | 元/年，回合 4 副业可 +20% |
| 年盈余 | `surplus` | 元/年，现金流缓冲 |
| 法律合规度 | `compliance` | 0–100 分 |
| 排放达标度 | `emission` | 0–100 分；由人均冬季采暖 CO₂ 线性标准化（见 §5.4） |
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

### 3.3 技术路线改造后年取暖费

均由**开局散煤年取暖费** `initialHeatingCost` 反推用量，再乘以能源价格（与排放模型用气/用电基准一致）。

| 选项 ID | 路线 | 计算方式 |
|---------|------|----------|
| A | 天然气 | `round(gasVolume × gasPricePerM3)` |
| B | 地源热泵 | `round(electricityKwh × electricityPricePerKwh)` |
| C | 空气源热泵 | `round(electricityKwh × electricityPricePerKwh)` |

共用中间量：

```
coalTons = initialHeatingCost / 1000
initialCoalInputEnergyGJ = coalTons × 23.2
gasVolume = coalTons × 250
```

天然气：

```
newHeatingCost = round(gasVolume × 2.98)    （补贴退坡前气价，元/m³）
```

热泵（地源 B / 空气源 C）：

```
electricityKwh = initialCoalInputEnergyGJ / heatGjPerKwh
  B：heatGjPerKwh = 0.0144
  C：heatGjPerKwh = 0.0106
newHeatingCost = round(electricityKwh × 0.5)    （元/kWh）
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

**A · 提高收入**

```
incomeBoost = round(income × 0.2)
income ← income + incomeBoost
surplus ← surplus + incomeBoost
```

排放达标度与 CO₂ **不变**（不调用排放重算）。

**B · 节约取暖**

```
newHeatingCost = round(heatingCost × 0.6)
surplus ← surplus + |newHeatingCost - heatingCost|
heatingCost ← newHeatingCost
isEnergySaving ← true
```

随后调用排放模型重算（节能系数 0.6）。

**C · 保暖修缮**

```
insulationCost = round(1000 × area / 100)
surplus ← surplus - insulationCost
heatingCost ← round(heatingCost × 0.625)
operatingFactor ← 0.625
```

随后调用排放模型重算（`E_current` 按 `operatingFactor` 缩放，再算排放达标度）。

### 3.7 回合 5 补贴退坡

| 常数 | 值 | 说明 |
|------|-----|------|
| `GAS_M3_PER_COAL_TON` | **250** | 1 吨散煤等价天然气立方米数 |
| `gasPricePerM3` | **2.98** | 元/m³，补贴退坡前终端气价 |
| `electricityPricePerKwh` | **0.5** | 元/kWh，热泵取暖电价 |
| `SUBSIDY_REDUCTION_PER_M3` | **0.6** | 元/m³，补贴退坡导致的用气成本上升（不变） |

```
coalTons = initialHeatingCost / 1000
gasVolume = coalTons × 250
rise = round(gasVolume × 0.6)
heatingCost ← heatingCost + rise
```

退坡后有效气价增量：**+0.6 元/m³**（相对退坡前 2.98 元/m³ 的账单冲击）。

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
| `coalEnergyGjPerTon` | 23.2 | GJ/吨 | 散煤输入能量（热泵电需求基准） |
| `coalCo2IntensityTco2PerTj` | **89.0** | tCO₂/TJ | 燃煤单位热值 CO₂ 排放因子（国标附表，已含碳氧化率） |
| `gasEnergyGjPerM3` | 0.036 | GJ/m³ | 天然气能量密度 |
| `gasCo2IntensityTco2PerTj` | **55.54** | tCO₂/TJ | 天然气单位热值 CO₂ 排放因子（国标附表，已含碳氧化率） |
| `gshpHeatGjPerKwh` | 0.0144 | GJ/kWh | 地源热泵产热系数 |
| `ashpHeatGjPerKwh` | 0.0106 | GJ/kWh | 空气源热泵产热系数 |
| `gridEmissionKgco2PerKwh` | 0.6361 | kgCO₂/kWh | 华北电网排放因子 |

国标附表参考：燃煤 tC/TJ=26.1、碳氧化率 0.93 → tCO₂/TJ≈89.0；天然气 tC/TJ=15.3、碳氧化率 0.99 → tCO₂/TJ≈55.54。

### 5.2 排放基准（开局由散煤年取暖费建立）

```
coalTons = initialHeatingCost / 1000

initialCoalInputEnergyGJ = coalTons × 23.2

E_initial (吨 CO₂) = (initialCoalInputEnergyGJ / 1000) × 89.0
```

基准对象保存在 `emissionBaseline`，全程不变。

### 5.3 当前路线 CO₂ 排放量 `E_current`

节能标志 `isEnergySaving` 时，`energyMultiplier = 0.6`，否则为 `1.0`。

**散煤炉**

```
E_current = E_initial × energyMultiplier
```

**天然气**

```
gasVolume = coalTons × 250 × energyMultiplier
gasEnergyGJ = gasVolume × 0.036
E_current = (gasEnergyGJ / 1000) × 55.54
```

**地源热泵**

```
gshpElectricityKwh = (initialCoalInputEnergyGJ × energyMultiplier) / 0.0144
E_current = gshpElectricityKwh × 0.6361 × 0.001   （吨 CO₂）
```

**空气源热泵**

```
ashpElectricityKwh = (initialCoalInputEnergyGJ × energyMultiplier) / 0.0106
E_current = ashpElectricityKwh × 0.6361 × 0.001   （吨 CO₂）
```

界面展示 `co2Tons = E_current`（保留 3 位小数）。

### 5.4 排放达标度评分（唯一指定公式）

所有取暖方式（含散煤炉）均使用同一线性比例模型；**常住人口**来自用户填写的 `household_population`（若为 0 或未填，运行时回退为 `defaultPopulation = 4`）。

```
E_current = calculateCurrentEmission(heatingMethod, isEnergySaving)   （吨 CO₂，户级）

population = household_population > 0 ? household_population : 4

perCapitaCurrent = E_current / population    （吨 CO₂ / 人）

emission = clamp( round(100 - 20 × (perCapitaCurrent / 1.0)), 0, 100 )
```

参数（`simulation-config` → `emission`）：

| 字段 | 值 | 含义 |
|------|-----|------|
| `perCapitaBaselineTons` | **1.0** | 人均基准排放量（吨 CO₂/人） |
| `scoreSlope` | **20** | 线性斜率 |
| `defaultPopulation` | **4** | 常住人口缺失时的回退值 |

含义：当人均排放 = 1.0 吨/人时得 80 分；人均越低分数越高，人均 ≥ 5.0 吨/人时为 0 分。

---

## 6. 结局判定

### 6.1 固定阈值（页面隐藏字段，不可由用户修改）

| 参数 | 值 | 用途 |
|------|-----|------|
| `bankrupt_energy_burden_threshold` | **10** % | 早期/负担判定参考 |
| `seized_compliance_threshold` | **30** | 执法模型门槛 |
| `success_emission_threshold` | **80** | 成功：排放达标度下限 |
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
emission >= 80
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
| **运行时数值源** | 本文档 §0 的 `simulation-config` JSON 块（`index.html` 启动时自动读取） |
| 回合流程代码 | `index.html` |
| 校准参考 | `research/data/calibration_defaults.json`（研究用，非运行时绑定） |
| 产品说明 | `spec.md` |
| 更新时机 | 改常数/阈值 → 只改 §0 JSON 并刷新网页；改公式或回合逻辑 → 同步改 `index.html` 与本文件文字说明 |
