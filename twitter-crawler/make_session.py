import json

cookie_str = r'__cuid=2927954b73df4aaebabf6456dae64fbd; lang=en; guest_id=v1%3A177388854199903760; guest_id_marketing=v1%3A177388854199903760; guest_id_ads=v1%3A177388854199903760; personalization_id="v1_S8mwL049m2y5pqifcdgOVQ=="; g_state={"i_l":0,"i_ll":1773888543246,"i_e":{"enable_itp_optimization":0}}; ct0=b36d2ee40e3f800af39881e3593580062cf816e205fc6919ea721eb29fe78126693bb30874769a55b1701f361ec397852c1397d03c8ee0da29495ec0dae8b7d9f3c73f78da42c1279c7e236ac7efd7be; twid=u%3D2034462058494963712; external_referer=padhuUp37zjqe56gIzs8pw3o7N4Zqg7X%2B42RzE02gZ43GNhHgpYY9w%3D%3D|0|8e8t2xd8A2w%3D'

cookies = []
for pair in cookie_str.split("; "):
    if "=" not in pair:
        continue
    name, _, value = pair.partition("=")
    cookies.append({
        "name": name.strip(),
        "value": value.strip(),
        "domain": ".x.com",
        "path": "/",
        "expires": -1,
        "httpOnly": False,
        "secure": True,
        "sameSite": "None",
    })

session = {"cookies": cookies, "origins": []}
with open("twitter_session.json", "w", encoding="utf-8") as f:
    json.dump(session, f, ensure_ascii=False, indent=2)

print(f"OK: {len(cookies)} cookies saved to twitter_session.json")
