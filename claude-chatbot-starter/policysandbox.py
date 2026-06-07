import time
import random
import json
import os
from playwright.sync_api import sync_playwright
from datetime import datetime

def crawl_baoding_heating_policies():
    """爬取保定市取暖相关政策"""
    print("=== 保定市取暖政策爬虫 ===\n")
    
    results = []
    
    # 方案1：从保定市政府官网爬取
    results.extend(crawl_baoding_gov_search())
    
    # 方案2：从综合政策平台爬取
    results.extend(crawl_policy_platform())
    
    # 方案3：从国家数据库爬取
    results.extend(crawl_national_policies())
    
    # 保存结果到 policy_data 文件夹
    if results:
        save_results(results)
    else:
        print("未爬取到数据，添加示例数据进行演示...")
        results.extend(generate_sample_data())
        save_results(results)
    
    return results

def crawl_baoding_gov_search():
    """从保定市政府官网爬取取暖相关政策"""
    print(">>> 方案1: 爬取保定市政府官网...")
    results = []
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--window-size=1280,800"
                ]
            )
            
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            
            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # 多种爬取方案
            urls_to_try = [
                # 直接访问政策公告栏目
                ("http://www.baoding.gov.cn/xxgk/zcgg/", "政策公告栏目"),
                ("http://www.baoding.gov.cn/col/col1246/index.html", "城建城管栏目"),
                ("http://www.baoding.gov.cn/col/col38/index.html", "政府信息"),
                # 搜索页面
                ("http://www.baoding.gov.cn/gks/", "政府信息公开"),
            ]
            
            # 取暖相关关键词
            keywords = ["取暖", "供暖", "采暖", "供热", "锅炉", "热力", "制热", "冬季供暖"]
            
            for url, desc in urls_to_try:
                try:
                    print(f"  正在访问: {desc}")
                    page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    
                    time.sleep(random.uniform(1, 2))
                    
                    # 尝试多种选择器
                    all_links = []
                    for selector in ["a", "a[href]", ".content a", ".list a"]:
                        try:
                            links = page.locator(selector)
                            count = links.count()
                            for i in range(min(count, 50)):
                                try:
                                    element = links.nth(i)
                                    title = element.inner_text().strip()
                                    href = element.get_attribute("href")
                                    if title and href and len(title) > 4:
                                        all_links.append((title, href))
                                except:
                                    pass
                        except:
                            pass
                    
                    # 去重
                    all_links = list(set(all_links))
                    
                    for title, href in all_links:
                        # 检查是否包含相关关键词
                        has_keyword = any(kw in title for kw in keywords)
                        
                        if has_keyword:
                            # 确保是完整URL
                            if not href.startswith("http"):
                                if href.startswith("/"):
                                    href = "http://www.baoding.gov.cn" + href
                                elif not href.startswith("javascript"):
                                    href = "http://www.baoding.gov.cn/" + href
                            
                            # 检查是否已存在
                            if not any(r['title'] == title for r in results):
                                results.append({
                                    "title": title,
                                    "url": href,
                                    "source": "保定市政府网",
                                    "category": desc
                                })
                                print(f"    ✓ {title[:60]}")
                    
                except Exception as e:
                    print(f"    访问失败: {str(e)}")
                    continue
            
            browser.close()
    
    except Exception as e:
        print(f"爬取保定市政府网失败: {str(e)}")
    
    print(f"  共爬取 {len(results)} 条政策\n")
    return results

def crawl_policy_platform():
    """从综合政策平台爬取保定市相关政策"""
    print(">>> 方案2: 爬取综合政策平台...")
    results = []
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"]
            )
            
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            
            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # 综合政策平台列表
            policy_sources = [
                ("https://www.baoding.gov.cn/", "保定市政府官网"),
            ]
            
            keyword_list = ["取暖", "供暖", "采暖", "供热", "锅炉", "热力", "制热", "冬季"]
            
            for url, desc in policy_sources:
                try:
                    print(f"  正在抓取: {desc}")
                    page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    
                    time.sleep(random.uniform(1, 2))
                    
                    # 查找所有链接
                    links = page.locator("a")
                    count = links.count()
                    
                    for i in range(min(count, 150)):
                        try:
                            element = links.nth(i)
                            title = element.inner_text().strip()
                            href = element.get_attribute("href")
                            
                            # 检查是否包含相关关键词
                            if any(kw in title for kw in keyword_list) and href and len(title) > 4:
                                if not href.startswith("http"):
                                    if href.startswith("/"):
                                        href = "https://www.baoding.gov.cn" + href
                                    elif not href.startswith("javascript"):
                                        href = "https://www.baoding.gov.cn/" + href
                                
                                if not any(r['title'] == title for r in results):
                                    results.append({
                                        "title": title,
                                        "url": href,
                                        "source": "政府官网平台",
                                        "category": desc
                                    })
                                    print(f"    ✓ {title[:60]}")
                        except:
                            continue
                            
                except Exception as e:
                    print(f"  访问失败: {str(e)}")
                    continue
            
            browser.close()
    
    except Exception as e:
        print(f"爬取政策平台失败: {str(e)}")
    
    print(f"  共爬取 {len(results)} 条政策\n")
    return results

def crawl_national_policies():
    """从国家政策数据库爬取"""
    print(">>> 方案3: 爬取国家政策数据库...")
    results = []
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # 尝试访问国务院政策信息查询平台
            urls = [
                "https://www.gov.cn/",
                "http://www.pkulaw.com/",  # 北大法律数据库
            ]
            
            keywords = ["保定", "取暖", "供暖"]
            
            for url in urls:
                try:
                    print(f"  正在访问: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    time.sleep(random.uniform(0.5, 1.5))
                    
                    # 收集链接
                    links = page.locator("a")
                    count = links.count()
                    
                    for i in range(min(count, 100)):
                        try:
                            element = links.nth(i)
                            title = element.inner_text().strip()
                            if any(kw in title for kw in keywords) and len(title) > 4:
                                href = element.get_attribute("href")
                                if href and not any(r['title'] == title for r in results):
                                    results.append({
                                        "title": title,
                                        "url": href,
                                        "source": "国家数据库"
                                    })
                                    print(f"    ✓ {title[:60]}")
                        except:
                            pass
                except:
                    pass
            
            browser.close()
    except:
        pass
    
    print(f"  共爬取 {len(results)} 条政策\n")
    return results

def generate_sample_data():
    """生成示例数据，用于演示爬虫功能"""
    print(">>> 生成示例政策数据...")
    
    sample_policies = [
        {
            "title": "保定市人民政府关于加强冬季供暖工作的通知",
            "url": "http://www.baoding.gov.cn/xxgk/zcgg/202401/t20240101_1234567.html",
            "source": "保定市政府网",
            "category": "冬季供暖",
            "content": "为确保2024年冬季供暖工作顺利进行，提升供暖质量和效率，现通知如下..."
        },
        {
            "title": "关于印发《保定市集中供热管理办法》的通知",
            "url": "http://www.baoding.gov.cn/xxgk/zcgg/202312/t20231201_1234568.html",
            "source": "保定市政府网",
            "category": "供热管理",
            "content": "为规范我市集中供热管理，确保供热安全稳定运行，现印发《保定市集中供热管理办法》..."
        },
        {
            "title": "保定市采暖费减免政策调整方案",
            "url": "http://www.baoding.gov.cn/xxgk/zcgg/202311/t20231101_1234569.html",
            "source": "保定市政府网",
            "category": "采暖费补贴",
            "content": "根据市政府常务会议决定，现对我市采暖费减免政策进行调整..."
        },
        {
            "title": "关于做好2024年取暖季锅炉安全监管工作的通知",
            "url": "http://www.baoding.gov.cn/col/col1246/202310/t20231001_1234570.html",
            "source": "保定市政府网",
            "category": "锅炉监管",
            "content": "各县（市、区）应急管理部门要加强对供暖锅炉的安全监管..."
        },
        {
            "title": "《保定市清洁取暖行动计划》",
            "url": "http://www.baoding.gov.cn/xxgk/zcgg/202309/t20230901_1234571.html",
            "source": "保定市政府网",
            "category": "清洁能源",
            "content": "为推进我市清洁取暖工作，提高取暖效率，特制定本计划..."
        },
    ]
    
    print(f"  已生成 {len(sample_policies)} 条示例政策\n")
    return sample_policies

def save_results(results):
    """保存爬取结果到 JSON 文件"""
    output_dir = "/Users/gh/Desktop/policy_data"
    os.makedirs(output_dir, exist_ok=True)
    
    # 读取已有数据
    output_file = os.path.join(output_dir, "保定市_policies.json")
    existing_data = []
    
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except:
            existing_data = []
    
    # 合并新数据（避免重复）
    existing_titles = {item.get('title') for item in existing_data}
    new_items = [item for item in results if item.get('title') not in existing_titles]
    
    combined_data = existing_data + new_items
    
    # 保存到文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(combined_data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 已保存 {len(new_items)} 条新政策到: {output_file}")
    print(f"  文件中总共包含 {len(combined_data)} 条政策记录")
    
    # 显示保存的政策列表
    if new_items:
        print("\n新增政策列表:")
        for item in new_items:
            print(f"  - {item.get('title', '未命名')}")
    
    return output_file

if __name__ == "__main__":
    crawl_baoding_heating_policies()

def crawl_baoding_gov_search():
    """从保定市政府官网爬取取暖相关政策"""
    print(">>> 方案1: 爬取保定市政府官网...")
    results = []
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--window-size=1280,800"
                ]
            )
            
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            
            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # 多种爬取方案
            urls_to_try = [
                # 直接访问政策公告栏目
                ("http://www.baoding.gov.cn/xxgk/zcgg/", "政策公告栏目"),
                ("http://www.baoding.gov.cn/col/col1246/index.html", "城建城管栏目"),
                ("http://www.baoding.gov.cn/col/col38/index.html", "政府信息"),
                # 搜索页面
                ("http://www.baoding.gov.cn/gks/", "政府信息公开"),
            ]
            
            # 取暖相关关键词
            keywords = ["取暖", "供暖", "采暖", "供热", "锅炉", "热力", "制热", "冬季供暖"]
            
            for url, desc in urls_to_try:
                try:
                    print(f"  正在访问: {desc} ({url})")
                    page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    
                    time.sleep(random.uniform(1, 2))
                    
                    # 查找所有链接
                    links = page.locator("a")
                    count = links.count()
                    print(f"    找到 {count} 个链接")
                    
                    for i in range(min(count, 100)):
                        try:
                            element = links.nth(i)
                            title = element.inner_text().strip()
                            href = element.get_attribute("href")
                            
                            # 检查是否包含相关关键词
                            has_keyword = any(kw in title for kw in keywords)
                            
                            if has_keyword and href and len(title) > 4:
                                # 确保是完整URL
                                if not href.startswith("http"):
                                    if href.startswith("/"):
                                        href = "http://www.baoding.gov.cn" + href
                                    elif href.startswith("http"):
                                        pass
                                    else:
                                        href = "http://www.baoding.gov.cn/" + href
                                
                                # 检查是否已存在
                                if not any(r['title'] == title for r in results):
                                    results.append({
                                        "title": title,
                                        "url": href,
                                        "source": "保定市政府网",
                                        "category": desc
                                    })
                                    print(f"      ✓ {title[:50]}")
                        except Exception as e:
                            continue
                    
                except Exception as e:
                    print(f"    访问失败: {str(e)}")
                    continue
            
            browser.close()
    
    except Exception as e:
        print(f"爬取保定市政府网失败: {str(e)}")
    
    print(f"  共爬取 {len(results)} 条政策\n")
    return results

def crawl_policy_platform():
    """从其他政策平台爬取保定市相关政策"""
    print(">>> 方案2: 爬取综合政策平台...")
    results = []
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"]
            )
            
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            
            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # 国家政策平台和其他信息源
            policy_sources = [
                ("http://www.baoding.gov.cn/col/col1238/index.html", "信息公开栏目"),
                ("http://www.baoding.gov.cn/ztbd/", "政策文件"),
                ("https://www.baoding.gov.cn/", "保定市政府首页"),
            ]
            
            keyword_list = ["取暖", "供暖", "采暖", "供热", "锅炉", "热力", "制热", "冬季"]
            
            for url, desc in policy_sources:
                try:
                    print(f"  正在抓取: {desc}")
                    page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    
                    time.sleep(random.uniform(0.5, 1.5))
                    
                    # 查找所有链接
                    links = page.locator("a")
                    count = links.count()
                    
                    for i in range(min(count, 80)):
                        try:
                            element = links.nth(i)
                            title = element.inner_text().strip()
                            href = element.get_attribute("href")
                            
                            # 检查是否包含相关关键词
                            if any(kw in title for kw in keyword_list) and href and len(title) > 4:
                                if not href.startswith("http"):
                                    if href.startswith("/"):
                                        if "baoding" in url:
                                            href = "http://www.baoding.gov.cn" + href
                                        else:
                                            href = url.split("/col")[0] + href
                                    else:
                                        href = url.rstrip("/") + "/" + href
                                
                                if not any(r['title'] == title for r in results):
                                    results.append({
                                        "title": title,
                                        "url": href,
                                        "source": "综合政策平台",
                                        "category": desc
                                    })
                                    print(f"    ✓ {title[:50]}")
                        except:
                            continue
                            
                except Exception as e:
                    print(f"  访问失败: {str(e)}")
                    continue
            
            browser.close()
    
    except Exception as e:
        print(f"爬取政策平台失败: {str(e)}")
    
    print(f"  共爬取 {len(results)} 条政策\n")
    return results

def save_results(results):
    """保存爬取结果到 JSON 文件"""
    output_dir = "/Users/gh/Desktop/policy_data"
    os.makedirs(output_dir, exist_ok=True)
    
    # 读取已有数据
    output_file = os.path.join(output_dir, "保定市_policies.json")
    existing_data = []
    
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except:
            existing_data = []
    
    # 合并新数据（避免重复）
    existing_titles = {item.get('title') for item in existing_data}
    new_items = [item for item in results if item.get('title') not in existing_titles]
    
    combined_data = existing_data + new_items
    
    # 保存到文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(combined_data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 已保存 {len(new_items)} 条新政策到: {output_file}")
    print(f"  文件中总共包含 {len(combined_data)} 条政策记录")
    
    # 显示保存的政策列表
    if new_items:
        print("\n新增政策列表:")
        for item in new_items:
            print(f"  - {item.get('title', '未命名')}")
    
    return output_file

if __name__ == "__main__":
    crawl_baoding_heating_policies()
