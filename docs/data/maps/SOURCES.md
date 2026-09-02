# G1 地图数据来源

本目录下的文件全部由 `scripts/build_map_data.py` 从下列上游生成，不要手工编辑。
重跑：

```
uv run --no-project --with pyshp --with numpy --with pillow --with tifffile \
    --with imagecodecs python scripts/build_map_data.py
```

例外：`country-label-overrides.json` 由产品负责人维护，脚本不会覆盖它。

## 上游

| 产物 | 上游 | 许可 | 输入 SHA256 |
|---|---|---|---|
| `admin0` | [Natural Earth 1:50m Admin 0 – Countries](https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip) | Public domain (Natural Earth terms of use) | `5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139` |
| `admin1` | [Natural Earth 1:10m Admin 1 – States, Provinces](https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip) | Public domain (Natural Earth terms of use) | `efc59726337323058f9446210adc96673179cd344e053666ee3d28cb58ba2b05` |
| `places` | [Natural Earth 1:50m Populated Places](https://naciscdn.org/naturalearth/50m/cultural/ne_50m_populated_places.zip) | Public domain (Natural Earth terms of use) | `9022c3be867be79c44bd6fc6ff4dcc210e85ffee13b033bf4d1d87d83c9ee6b4` |
| `koppen` | [Köppen-Geiger climate classification maps 1991–2020, 0.1° (Beck et al. 2023)](https://www.gloh2o.org/koppen/) · member `1991_2020/koppen_geiger_0p1.tif` | CC BY 4.0 | `59b749fe6711e72c720ff903044eb0efb4373524ee434740ed7384a0284c155b` |

Köppen 数据引用要求：

> Beck, H. E., T. R. McVicar, N. Vergopolan, A. Berg, N. J. Lutsko, A. Dufour, Z. Zeng, X. Jiang, A. I. J. M. van Dijk, and D. G. Miralles. High-resolution (1 km) Köppen-Geiger maps for 1901-2099 based on constrained CMIP6 projections, Scientific Data 10, 724 (2023).

## 处理步骤

1. **坐标精度**：所有坐标保留 3 位小数（赤道约 110 m），并去掉相邻重复点。
   这不是几何简化 —— Natural Earth 1:50m 自身的定位误差约 0.5–2 km，远大于这个量级。
   未做任何 Douglas–Peucker 之类的拓扑简化，因为点在国界附近的归属会直接影响能源价格取值。
2. **ISO3 修正**：Natural Earth 的 `ISO_A3` 对部分国家写作 `-99`。
   按 `ISO_A3` → `ISO_A3_EH` → `ADM0_A3` 依次回退，本次共修正 8 个要素：
   - Somaliland → `SOL`（取自 `ADM0_A3`）
   - Norway → `NOR`（取自 `ISO_A3_EH`）
   - Kosovo → `KOS`（取自 `ADM0_A3`）
   - France → `FRA`（取自 `ISO_A3_EH`）
   - Northern Cyprus → `CYN`（取自 `ADM0_A3`）
   - Indian Ocean Territories → `AUS`（取自 `ISO_A3_EH`）
   - Ashmore and Cartier Islands → `AUS`（取自 `ISO_A3_EH`）
   - Siachen Glacier → `KAS`（取自 `ADM0_A3`）
3. **Admin-1 只取中美**：规格 §G1 明令其余国家不识别省/州。
   本次得到 CHN 31 个、USA 51 个。

   **`admin1_code` 取 ISO 3166-2 的后缀，不是 Natural Earth 的 `postal` 字段。**
   这两套编码对中国省份互相撞码，用错会静默绑到另一个省：

   | ISO 3166-2 后缀（本产物采用） | 是哪个省 | 而 NE `postal` 里同样的字母是 |
   |---|---|---|
   | `HE` | 河北省（本项目试点所在地） | 河南 |
   | `HA` | 河南省 | 海南 |
   | `HB` | 湖北省 | 河北 |

   全部不一致的条目：

   | `admin1_code`（ISO） | NE `postal` | 名称 |
   |---|---|---|
   | `HI` | `HA` | Hainan / 海南省 |
   | `HE` | `HB` | Hebei / 河北省 |
   | `SN` | `SA` | Shaanxi / 陕西省 |
   | `HA` | `HE` | Henan / 河南省 |
   | `HB` | `HU` | Hubei / 湖北省 |

   美国 51 个要素两种编码完全一致，因此 `docs/data/climate/*` 骨架与
   `docs/tests/global/fixtures/` 里既有的 `"IL"` 约定不受影响。
   `build_map_data.py` 里对 `HE→河北`、`HA→河南` 等绑定写了硬断言，上游改编码会直接构建失败。

   上游在这两国下还混了没有有效 ISO 3166-2 码的非省级要素，已跳过（在其范围内点击只识别到国家）：
   - CHN / Paracel Islands（上游 `iso_3166_2` = `CN-X01~`，类型未标注）
4. **城市点位**：只保留 `scalerank ≤ 5` 的点，仅作定位辅助，不参与任何气候取值。
5. **Köppen 栅格**：取上游 zip 中的 `1991_2020/koppen_geiger_0p1.tif`（作者自己发布的 0.1° 产品，
   不是我们自行重采样 1 km 版本得到的）。转成 8 位灰度 PNG，像素值即分类索引，
   并显式校验输出里不含 `gAMA` / `iCCP` / `sRGB` / `cHRM` 块 —— 带色彩配置的 PNG 会被浏览器
   做色彩管理转换，像素值被悄悄改掉且不报错。写出后逐像素回读比对。

## 已知精度边界

- Köppen 网格 0.1°（赤道约 11 km），有效陆地占 34.12%。
  海岸线和山区会错分类。它回答的是「该用哪个标准气候区 profile」，不是该点的实测气候。
- Natural Earth 1:50m 国界为小比例尺产品，紧贴国界的点可能归错国家。
- 中美省/州界用 1:10m，精度高于国界层。

## 边界与称谓

Natural Earth 对争议地区的切分与标注是它自己的编辑立场。具体到本产品：

- `TWN` 在上游是**独立的 admin0 要素**（sov_a3 `TWN`），本产物中显示为 '中国台湾'（已覆盖上游的 '中华民国'）。注意这只改了称谓，没有改几何切分：在该地点击仍得到 `country_iso3 = TWN`，**不会**进入中美 Admin-1 分支，会落到 Köppen 标准 profile。
- `HKG` 在上游是**独立的 admin0 要素**（sov_a3 `CH1`），本产物中显示为 '中国香港'（已覆盖上游的 '香港'）。注意这只改了称谓，没有改几何切分：在该地点击仍得到 `country_iso3 = HKG`，**不会**进入中美 Admin-1 分支，会落到 Köppen 标准 profile。
- `MAC` 在上游是**独立的 admin0 要素**（sov_a3 `CH1`），本产物中显示为 '中国澳门'（已覆盖上游的 '澳门'）。注意这只改了称谓，没有改几何切分：在该地点击仍得到 `country_iso3 = MAC`，**不会**进入中美 Admin-1 分支，会落到 Köppen 标准 profile。
- 以下 ISO3 对应多个要素：{'AUS': 3}（识别时任一命中即可）。
- 上游把 'Paracel Islands' 列为 `CHN` 的 Admin-1 要素，但只给了自造占位码 `CN-X01~`（非真实 ISO 3166-2），已跳过；在其范围内点击只会识别到国家。

这些属产品决策，不由 CS 决定。改动方式是编辑 `country-label-overrides.json`（显示名）
或更换上游边界源（切分方式），两者都不需要改识别代码。详见 `docs/HANDOFF.md`。
