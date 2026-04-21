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
        "content": item.get("content") or item.get("summary") or "",
        "coverImageUrl": item.get("coverImageUrl") or "",
        "tags": item.get("tags") or ["公众号", "微信文章"],
        "publishedAt": item.get("publishedAt") or "",
        "metrics": item.get("metrics") or {"type": "公众号"},
    }


def build_wechat_headers(cookie_string: str) -> dict:
    return {
        "cookie": cookie_string,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "referer": "https://mp.weixin.qq.com/",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
    }


def read_wechat_auth_cache(cache_file: str) -> dict:
    if not cache_file:
        return {}
    cache_path = Path(cache_file)
    if not cache_path.exists():
        return {}
    try:
        with cache_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except Exception:
        return {}
    if not isinstance(payload, dict):
        return {}
    return payload


def get_wechat_cookie_from_cache(cache_file: str) -> str:
    payload = read_wechat_auth_cache(cache_file)
    cookie_string = (
        payload.get("cookieString")
        or payload.get("cookie_string")
        or payload.get("cookie")
        or payload.get("cookies")
        or ""
    )
    if isinstance(cookie_string, list):
        return "; ".join(
            f"{item.get('name')}={item.get('value')}"
            for item in cookie_string
            if isinstance(item, dict) and item.get("name") and item.get("value")
        )
    if isinstance(cookie_string, dict):
        return "; ".join(f"{key}={value}" for key, value in cookie_string.items() if value)
    return str(cookie_string or "").strip()


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


def fetch_wechat_article(url: str, headers: dict | None = None, default_title: str = "", default_author: str = "", published_at: str = "", content_override: str = "") -> dict:
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
    if re.search(r"访问过于频繁|环境异常|请在微信客户端打开|当前页面无法访问|操作频繁|wappoc_appmsgcaptcha", response.text):
        raise RuntimeError("公众号文章触发环境验证，需要手动滑动验证后继续抓取。")
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
    content = content_override.strip() or content_text
    if not content.strip():
        raise RuntimeError("公众号文章没有抓取到正文。")
    summary = re.sub(r"\s+", " ", content).strip()[:220] or title
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
        "content": content,
        "coverImageUrl": cover,
        "tags": ["公众号", "微信文章"],
        "publishedAt": publish,
        "metrics": {
            "type": "公众号",
            "contentChars": len(content),
        },
    }
    return normalize_wechat_item(article)


def build_wechat_article_from_spider(url: str, content: str, default_title: str = "", default_author: str = "", published_at: str = "") -> dict:
    cleaned = re.sub(r"\s+", " ", content).strip()
    title = default_title.strip()
    if not title:
        heading_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        title = heading_match.group(1).strip() if heading_match else "公众号文章"
    cover_match = re.search(r"!\[[^\]]*\]\(([^)\s]+)", content)
    item = {
        "id": url,
        "title": title,
        "url": url,
        "authorName": default_author or "公众号",
        "summary": cleaned[:220] or title,
        "content": content.strip(),
        "coverImageUrl": cover_match.group(1) if cover_match else "",
        "tags": ["公众号", "微信文章"],
        "publishedAt": published_at,
        "metrics": {
            "type": "公众号",
            "contentChars": len(content.strip()),
            "source": "wechat_spider",
        },
    }
    return normalize_wechat_item(item)


def infer_xhs_mode(query: str, requested_mode: str) -> str:
    if requested_mode and requested_mode != "auto":
        return requested_mode
    if query.startswith("http://") or query.startswith("https://"):
        return "user" if "/user/profile/" in query else "note"
    return "search"


def run_xhs(project_root: Path, query: str, limit: int, options: dict | None = None) -> dict:
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
    options = options or {}
    mode = infer_xhs_mode(query, str(options.get("xhsMode") or "auto"))

    if mode == "note":
        success, msg, note_info = spider.spider_note(query, cookies)
        if not success or not note_info:
            raise RuntimeError(f"Spider_XHS 抓取失败: {msg}")
        items = [normalize_xhs_item(note_info)]
    elif mode == "user":
        success, msg, all_note_info = spider.xhs_apis.get_user_all_notes(query, cookies, None)
        if not success:
            raise RuntimeError(f"Spider_XHS 用户主页抓取失败: {msg}")
        items = []
        for simple_note in (all_note_info or [])[:limit]:
            note_url = f"https://www.xiaohongshu.com/explore/{simple_note['note_id']}?xsec_token={simple_note['xsec_token']}"
            ok, _, note_info = spider.spider_note(note_url, cookies)
            if ok and note_info:
                items.append(normalize_xhs_item(note_info))
    else:
        geo = None
        if int(options.get("xhsPosDistance") or 0) in (1, 2):
            latitude = str(options.get("xhsGeoLatitude") or "").strip()
            longitude = str(options.get("xhsGeoLongitude") or "").strip()
            if latitude and longitude:
                geo = {"latitude": float(latitude), "longitude": float(longitude)}
        success, msg, notes = spider.xhs_apis.search_some_note(
            query,
            limit,
            cookies,
            int(options.get("xhsSortTypeChoice") or 0),
            int(options.get("xhsNoteType") or 0),
            int(options.get("xhsNoteTime") or 0),
            int(options.get("xhsNoteRange") or 0),
            int(options.get("xhsPosDistance") or 0),
            geo,
            None,
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


def infer_douyin_mode(query: str, requested_mode: str) -> str:
    if requested_mode and requested_mode != "auto":
        return requested_mode
    if query.startswith("http://") or query.startswith("https://"):
        return "user" if "/user/" in query and "modal_id=" not in query and "/video/" not in query else "work"
    return "search"


def run_douyin(project_root: Path, query: str, limit: int, options: dict | None = None) -> dict:
    os.chdir(project_root)
    sys.path.insert(0, str(project_root))

    from main import Data_Spider  # type: ignore
    from utils.common_util import init  # type: ignore
    from utils.data_util import handle_work_info  # type: ignore

    auth, _ = init()
    spider = Data_Spider()
    options = options or {}
    mode = infer_douyin_mode(query, str(options.get("douyinMode") or "auto"))

    if mode == "work":
        work_info = spider.spider_work(auth, query)
        items = [normalize_douyin_item(work_info)]
    elif mode == "user":
        user_info = spider.douyin_apis.get_user_info(auth, query)
        works = spider.douyin_apis.get_user_all_work_info(auth, query)
        items = []
        for work_info in (works or [])[:limit]:
            work_info["author"].update(user_info.get("user", {}))
            items.append(normalize_douyin_item(handle_work_info(work_info)))
    else:
        results = spider.douyin_apis.search_some_general_work(
            auth,
            query,
            limit,
            str(options.get("douyinSortType") or "0"),
            str(options.get("douyinPublishTime") or "0"),
            str(options.get("douyinFilterDuration") or ""),
            str(options.get("douyinSearchRange") or "0"),
            str(options.get("douyinContentType") or "0"),
        )
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


def infer_wechat_mode(query: str, requested_mode: str) -> str:
    if requested_mode and requested_mode != "auto":
        return requested_mode
    if query.startswith("http://") or query.startswith("https://"):
        return "article"
    if "\n" in query or "，" in query or "," in query:
        return "batch"
    return "account"


def run_wechat(project_root: Path, query: str, limit: int, options: dict | None = None) -> dict:
    wechat_token = os.environ.get("SOCIAL_BRIDGE_WECHAT_TOKEN", "").strip()
    wechat_cookie = os.environ.get("SOCIAL_BRIDGE_WECHAT_COOKIE", "").strip()
    wechat_cache_file = os.environ.get("SOCIAL_BRIDGE_WECHAT_CACHE_FILE", "").strip()
    options = options or {}
    mode = infer_wechat_mode(query, str(options.get("wechatMode") or "auto"))

    if mode == "article":
        cached_cookie = get_wechat_cookie_from_cache(wechat_cache_file)
        effective_cookie = wechat_cookie or cached_cookie
        headers = build_wechat_headers(effective_cookie) if effective_cookie else None
        content_from_spider = ""
        try:
            os.chdir(project_root)
            sys.path.insert(0, str(project_root))
            from spider.wechat.utils import get_article_content  # type: ignore

            content_from_spider = get_article_content(query, headers or {})
            if content_from_spider.startswith(("请求失败", "获取文章内容失败")):
                content_from_spider = ""
        except Exception:
            content_from_spider = ""

        if content_from_spider.strip():
            try:
                item = fetch_wechat_article(
                    query,
                    headers=headers,
                    content_override=content_from_spider,
                )
            except Exception:
                item = build_wechat_article_from_spider(query, content_from_spider)
        else:
            item = fetch_wechat_article(
                query,
                headers=headers,
            )
        return {
            "provider": "wechat",
            "query": query,
            "items": [item],
            "message": "wechat_spider 文章正文抓取完成。" if content_from_spider.strip() else "公众号文章抓取完成。",
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
    scraper.request_delay = (1, max(2, int(options.get("wechatInterval") or os.environ.get("SOCIAL_BRIDGE_WECHAT_REQUEST_INTERVAL", "8") or "8")) / 2)

    if mode == "search":
        accounts = scraper.search_account(query)
        items = [
            normalize_wechat_item(
                {
                    "id": account.get("wpub_fakid") or account.get("wpub_name") or "",
                    "title": account.get("wpub_name") or "未命名公众号",
                    "url": "",
                    "authorName": account.get("wpub_name") or "未知公众号",
                    "summary": f"fakeid: {account.get('wpub_fakid') or ''}",
                    "tags": ["公众号", "账号搜索"],
                    "metrics": {"type": "公众号账号"},
                }
            )
            for account in accounts[:limit]
        ]
        return {
            "provider": "wechat",
            "query": query,
            "items": items,
            "message": f"wechat_spider 搜索到 {len(items)} 个公众号。",
        }

    account_names = re.split(r"[\n\r,;，；、|]+", query) if mode == "batch" else [query]
    account_names = [name.strip() for name in account_names if name.strip()]
    pages = max(1, min(10, int(options.get("wechatPages") or os.environ.get("SOCIAL_BRIDGE_WECHAT_MAX_PAGES", "0") or "0") or ((limit + 4) // 5)))
    days = int(options.get("wechatDays") or 30)
    include_content = bool(options.get("wechatIncludeContent", True))
    keywords = [
        keyword.strip()
        for keyword in re.split(r"[,，;；\n\r]+", str(options.get("wechatKeywords") or ""))
        if keyword.strip()
    ]
    items = []
    for account_name in account_names:
        if len(items) >= limit:
            break
        accounts = scraper.search_account(account_name)
        if not accounts:
            continue
        account = accounts[0]
        articles = scraper.get_account_articles(account["wpub_name"], account["wpub_fakid"], pages)
        if days:
            from datetime import datetime, timedelta
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days)
            articles = scraper.filter_articles_by_date(articles, start_date, end_date)
        if keywords:
            articles = scraper.filter_articles_by_keywords(articles, keywords)

        for article in articles:
            if len(items) >= limit:
                break
            article_url = article.get("link") or ""
            if not article_url:
                continue
            if include_content:
                items.append(
                    fetch_wechat_article(
                        article_url,
                        headers=headers,
                        default_title=article.get("title") or "",
                        default_author=account["wpub_name"],
                        published_at=article.get("publish_time") or "",
                    )
                )
            else:
                items.append(
                    normalize_wechat_item(
                        {
                            "id": article_url,
                            "title": article.get("title") or "",
                            "url": article_url,
                            "authorName": account["wpub_name"],
                            "summary": article.get("digest") or article.get("title") or "",
                            "publishedAt": article.get("publish_time") or "",
                            "metrics": {"type": "公众号文章"},
                        }
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
    parser.add_argument("--options-json", default="{}")
    args = parser.parse_args()

    xhs_root = Path(args.xhs_root or r"F:\Projects\媒体信息投放\cv-cat\Spider_XHS")
    douyin_root = Path(args.douyin_root or r"F:\Projects\媒体信息投放\cv-cat\DouYin_Spider")
    wechat_root = Path(args.wechat_root or r"F:\Projects\公众号文章爬虫\wechat_spider\wechat_spider")

    try:
        try:
            options = json.loads(args.options_json or "{}")
        except Exception:
            options = {}

        if args.auth_provider == "wechat":
            payload = login_wechat(wechat_root, args.wechat_cache_file or "")
        elif args.provider == "xhs":
            if not args.query:
                raise RuntimeError("缺少 query 参数。")
            payload = run_xhs(xhs_root, args.query, args.limit, options)
        elif args.provider == "wechat":
            if not args.query:
                raise RuntimeError("缺少 query 参数。")
            payload = run_wechat(wechat_root, args.query, args.limit, options)
        else:
            if not args.query:
                raise RuntimeError("缺少 query 参数。")
            payload = run_douyin(douyin_root, args.query, args.limit, options)
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
