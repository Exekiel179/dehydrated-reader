import argparse
import json
import os
import re
import sys
from pathlib import Path


def normalize_xhs_item(item: dict) -> dict:
    image_list = item.get("image_list") or []
    return {
        "id": item.get("note_id") or item.get("title") or "",
        "title": item.get("title") or "未命名笔记",
        "url": item.get("note_url") or "",
        "provider": "xhs",
        "authorName": item.get("nickname") or "未知作者",
        "authorUrl": item.get("home_url") or "",
        "summary": item.get("desc") or item.get("title") or "",
        "coverImageUrl": item.get("video_cover") or (image_list[0] if image_list else ""),
        "tags": item.get("tags") or [],
        "publishedAt": item.get("upload_time") or "",
        "metrics": {
            "likes": item.get("liked_count") or 0,
            "comments": item.get("comment_count") or 0,
            "collects": item.get("collected_count") or 0,
            "shares": item.get("share_count") or 0,
            "type": item.get("note_type") or "未知",
            "ipLocation": item.get("ip_location") or "未知",
        },
    }


def normalize_douyin_item(item: dict) -> dict:
    return {
        "id": item.get("work_id") or item.get("title") or "",
        "title": item.get("title") or "未命名作品",
        "url": item.get("work_url") or "",
        "provider": "douyin",
        "authorName": item.get("nickname") or "未知作者",
        "authorUrl": item.get("user_url") or "",
        "summary": item.get("desc") or item.get("title") or "",
        "coverImageUrl": item.get("video_cover") or "",
        "tags": item.get("topics") or [],
        "publishedAt": str(item.get("create_time") or ""),
        "metrics": {
            "likes": item.get("digg_count") or 0,
            "comments": item.get("comment_count") or 0,
            "collects": item.get("collect_count") or 0,
            "shares": item.get("share_count") or 0,
            "type": item.get("work_type") or "未知",
            "ipLocation": item.get("ip_location") or "未知",
        },
    }


def normalize_wechat_item(item: dict) -> dict:
    return {
        "id": item.get("id") or item.get("url") or item.get("title") or "",
        "title": item.get("title") or "未命名公众号文章",
        "url": item.get("url") or "",
        "provider": "wechat",
        "authorName": item.get("authorName") or "未知公众号",
        "authorUrl": item.get("authorUrl") or "",
        "summary": item.get("summary") or item.get("title") or "",
        "coverImageUrl": item.get("coverImageUrl") or "",
        "tags": item.get("tags") or ["公众号", "微信文章"],
        "publishedAt": item.get("publishedAt") or "",
        "metrics": item.get("metrics") or {"type": "公众号"},
    }


def build_wechat_headers(cookie_string: str) -> dict:
    return {
        "cookie": cookie_string,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 MicroMessenger/8.0.49",
        "referer": "https://mp.weixin.qq.com/",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
    }


def login_wechat(project_root: Path, cache_file: str = "") -> dict:
    os.chdir(project_root)
    sys.path.insert(0, str(project_root))

    from spider.wechat.login import WeChatSpiderLogin  # type: ignore

    login_manager = WeChatSpiderLogin(cache_file=cache_file or "wechat_cache.json")
    if not login_manager.login():
        raise RuntimeError("公众号扫码登录失败。")

    token = login_manager.get_token() or ""
    cookie_string = login_manager.get_cookie_string() or ""
    cache_path = str(Path(project_root) / (cache_file or "wechat_cache.json"))

    if not token or not cookie_string:
        raise RuntimeError("公众号登录成功，但未能提取 token 或 cookie。")

    return {
        "provider": "wechat",
        "token": token,
        "cookieString": cookie_string,
        "cacheFile": cache_path,
        "message": "公众号扫码登录成功，已写回认证信息。",
    }


def fetch_wechat_article(url: str, headers: dict | None = None, default_title: str = "", default_author: str = "", published_at: str = "") -> dict:
    import requests
    from bs4 import BeautifulSoup

    request_headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 MicroMessenger/8.0.49",
        "referer": "https://mp.weixin.qq.com/",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
    }
    if headers:
        request_headers.update(headers)

    response = requests.get(url, headers=request_headers, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")

    def text_of(selector: str) -> str:
        node = soup.select_one(selector)
        return node.get_text(" ", strip=True) if node else ""

    def attr_of(selector: str, attr: str) -> str:
        node = soup.select_one(selector)
        if not node:
            return ""
        return (node.get(attr) or "").strip()

    title = (
        text_of("#activity-name")
        or attr_of("meta[property='og:title']", "content")
        or attr_of("meta[name='twitter:title']", "content")
        or (soup.title.get_text(strip=True) if soup.title else "")
        or default_title
    )
    author_name = text_of("#js_name") or text_of(".profile_nickname") or attr_of("meta[name='author']", "content") or default_author
    content_node = soup.select_one(".rich_media_content") or soup.select_one("#js_content")
    content_text = content_node.get_text(" ", strip=True) if content_node else ""
    content_text = re.sub(r"\s+", " ", content_text).strip()
    summary = content_text[:220] or title
    cover = (
        attr_of("meta[property='og:image']", "content")
        or attr_of("meta[name='twitter:image']", "content")
        or attr_of(".rich_media_thumb img", "src")
        or attr_of(".rich_media_thumb img", "data-src")
        or attr_of("#js_content img", "data-src")
        or attr_of("#js_content img", "src")
    )
    publish = (
        attr_of("meta[property='article:published_time']", "content")
        or published_at
    )
    if not publish:
        match = re.search(r"publish_time\s*=\s*['\"]?(\d{10})['\"]?", response.text)
        if match:
            publish = match.group(1)

    article = {
        "id": url,
        "title": title,
        "url": url,
        "authorName": author_name,
        "summary": summary,
        "coverImageUrl": cover,
        "tags": ["公众号", "微信文章"],
        "publishedAt": publish,
        "metrics": {
            "type": "公众号",
            "contentChars": len(content_text),
        },
    }
    return normalize_wechat_item(article)


def run_xhs(project_root: Path, query: str, limit: int) -> dict:
    os.chdir(project_root)
    sys.path.insert(0, str(project_root))

    from main import Data_Spider  # type: ignore
    from xhs_utils.common_util import init  # type: ignore

    cookies = os.environ.get("SOCIAL_BRIDGE_XHS_COOKIES", "").strip()
    if not cookies:
        cookies, _ = init()
    if not cookies:
        raise RuntimeError("Spider_XHS 缺少 COOKIES，请先在设置页或其 .env 中配置。")

    spider = Data_Spider()

    if query.startswith("http://") or query.startswith("https://"):
        success, msg, note_info = spider.spider_note(query, cookies)
        if not success or not note_info:
            raise RuntimeError(f"Spider_XHS 抓取失败: {msg}")
        items = [normalize_xhs_item(note_info)]
    else:
        success, msg, notes = spider.xhs_apis.search_some_note(
            query, limit, cookies, 0, 0, 0, 0, 0, None, None
        )
        if not success:
            raise RuntimeError(f"Spider_XHS 搜索失败: {msg}")
        items = []
        note_cards = [note for note in notes if note.get("model_type") == "note"][:limit]
        for note in note_cards:
            note_url = f"https://www.xiaohongshu.com/explore/{note['id']}?xsec_token={note['xsec_token']}"
            ok, _, note_info = spider.spider_note(note_url, cookies)
            if ok and note_info:
                items.append(normalize_xhs_item(note_info))

    return {
        "provider": "xhs",
        "query": query,
        "items": items,
        "message": f"Spider_XHS 返回 {len(items)} 条结果。",
    }


def run_douyin(project_root: Path, query: str, limit: int) -> dict:
    os.chdir(project_root)
    sys.path.insert(0, str(project_root))

    from main import Data_Spider  # type: ignore
    from utils.common_util import init  # type: ignore
    from utils.data_util import handle_work_info  # type: ignore

    auth, _ = init()
    spider = Data_Spider()

    if query.startswith("http://") or query.startswith("https://"):
        work_info = spider.spider_work(auth, query)
        items = [normalize_douyin_item(work_info)]
    else:
        results = spider.douyin_apis.search_some_general_work(auth, query, limit, "0", "0", "", "0", "0")
        items = []
        for result in results[:limit]:
            aweme_info = result.get("aweme_info")
            if aweme_info:
                items.append(normalize_douyin_item(handle_work_info(aweme_info)))

    return {
        "provider": "douyin",
        "query": query,
        "items": items,
        "message": f"DouYin_Spider 返回 {len(items)} 条结果。",
    }


def run_wechat(project_root: Path, query: str, limit: int) -> dict:
    wechat_token = os.environ.get("SOCIAL_BRIDGE_WECHAT_TOKEN", "").strip()
    wechat_cookie = os.environ.get("SOCIAL_BRIDGE_WECHAT_COOKIE", "").strip()
    wechat_cache_file = os.environ.get("SOCIAL_BRIDGE_WECHAT_CACHE_FILE", "").strip()

    if query.startswith("http://") or query.startswith("https://"):
        item = fetch_wechat_article(
            query,
            headers=build_wechat_headers(wechat_cookie) if wechat_cookie else None,
        )
        return {
            "provider": "wechat",
            "query": query,
            "items": [item],
            "message": "wechat_spider 直连抓取完成。",
        }

    os.chdir(project_root)
    sys.path.insert(0, str(project_root))

    from spider.wechat.run import WeChatSpiderRunner  # type: ignore
    from spider.wechat.login import WeChatSpiderLogin  # type: ignore
    from spider.wechat.scraper import WeChatScraper  # type: ignore

    runner = WeChatSpiderRunner()
    if wechat_cache_file:
        runner.login_manager = WeChatSpiderLogin(cache_file=wechat_cache_file)

    if wechat_token and wechat_cookie:
        token = wechat_token
        headers = build_wechat_headers(wechat_cookie)
    else:
        if not runner.login_manager.is_logged_in():
            raise RuntimeError("wechat_spider 未登录，请先在设置页填写 token/cookie，或在该项目中执行 python main.py wechat login 完成扫码登录。")
        token = runner.login_manager.get_token()
        headers = runner.login_manager.get_headers()

    scraper = WeChatScraper(token, headers)
    accounts = scraper.search_account(query)
    if not accounts:
        raise RuntimeError(f"未找到匹配的公众号: {query}")

    account = accounts[0]
    pages = max(1, min(3, (limit + 4) // 5))
    articles = scraper.get_account_articles(account["wpub_name"], account["wpub_fakid"], pages)

    items = []
    for article in articles[:limit]:
        article_url = article.get("link") or ""
        if not article_url:
            continue
        items.append(
            fetch_wechat_article(
                article_url,
                headers=headers,
                default_title=article.get("title") or "",
                default_author=account["wpub_name"],
                published_at=article.get("publish_time") or "",
            )
        )

    return {
        "provider": "wechat",
        "query": query,
        "items": items,
        "message": f"wechat_spider 返回 {len(items)} 条结果。",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=["xhs", "douyin", "wechat"])
    parser.add_argument("--auth-provider", choices=["wechat"])
    parser.add_argument("--query")
    parser.add_argument("--limit", type=int, default=6)
    parser.add_argument("--xhs-root")
    parser.add_argument("--douyin-root")
    parser.add_argument("--wechat-root")
    parser.add_argument("--wechat-cache-file")
    args = parser.parse_args()

    xhs_root = Path(args.xhs_root or r"F:\Projects\媒体信息投放\cv-cat\Spider_XHS")
    douyin_root = Path(args.douyin_root or r"F:\Projects\媒体信息投放\cv-cat\DouYin_Spider")
    wechat_root = Path(args.wechat_root or r"F:\Projects\公众号文章爬虫\wechat_spider\wechat_spider")

    try:
        if args.auth_provider == "wechat":
            payload = login_wechat(wechat_root, args.wechat_cache_file or "")
        elif args.provider == "xhs":
            if not args.query:
                raise RuntimeError("缺少 query 参数。")
            payload = run_xhs(xhs_root, args.query, args.limit)
        elif args.provider == "wechat":
            if not args.query:
                raise RuntimeError("缺少 query 参数。")
            payload = run_wechat(wechat_root, args.query, args.limit)
        else:
            if not args.query:
                raise RuntimeError("缺少 query 参数。")
            payload = run_douyin(douyin_root, args.query, args.limit)
        print(json.dumps(payload, ensure_ascii=False))
    except Exception as error:
        print(
            json.dumps(
                {
                    "provider": args.auth_provider or args.provider,
                    "query": args.query or "",
                    "items": [],
                    "message": str(error),
                    "error": True,
                },
                ensure_ascii=False,
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
