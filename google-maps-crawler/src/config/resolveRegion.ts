export type RegionConfig = {
  name: string;
  locale: string;
  timezoneId: string;
  profileKey: string;
};

export function resolveRegion(lat: number, lng: number): RegionConfig {

  // 🇻🇳 Vietnam
  if (lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110) {
    return {
      name: "Vietnam",
      locale: "vi-VN",
      timezoneId: "Asia/Ho_Chi_Minh",
      profileKey: "vn",
    };
  }

  // 🇱🇦 Laos
  if (lat >= 13 && lat <= 23 && lng >= 100 && lng <= 108) {
    return {
      name: "Laos",
      locale: "lo-LA",
      timezoneId: "Asia/Vientiane",
      profileKey: "la",
    };
  }

  // 🇰🇭 Cambodia
  if (lat >= 10 && lat <= 15 && lng >= 102 && lng <= 108) {
    return {
      name: "Cambodia",
      locale: "km-KH",
      timezoneId: "Asia/Phnom_Penh",
      profileKey: "kh",
    };
  }

  // 🇹🇭 Thailand
  if (lat >= 5 && lat <= 21 && lng >= 97 && lng <= 106) {
    return {
      name: "Thailand",
      locale: "th-TH",
      timezoneId: "Asia/Bangkok",
      profileKey: "th",
    };
  }

  // 🇲🇾 Malaysia
  if (lat >= 1 && lat <= 7 && lng >= 99 && lng <= 120) {
    return {
      name: "Malaysia",
      locale: "ms-MY",
      timezoneId: "Asia/Kuala_Lumpur",
      profileKey: "my",
    };
  }

  // 🇸🇬 Singapore
  if (lat >= 1 && lat <= 2 && lng >= 103 && lng <= 105) {
    return {
      name: "Singapore",
      locale: "en-SG",
      timezoneId: "Asia/Singapore",
      profileKey: "sg",
    };
  }

  // 🇮🇩 Indonesia
  if (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) {
    return {
      name: "Indonesia",
      locale: "id-ID",
      timezoneId: "Asia/Jakarta",
      profileKey: "id",
    };
  }

  // 🇵🇭 Philippines
  if (lat >= 4 && lat <= 21 && lng >= 116 && lng <= 127) {
    return {
      name: "Philippines",
      locale: "en-PH",
      timezoneId: "Asia/Manila",
      profileKey: "ph",
    };
  }

  // 🇲🇲 Myanmar
  if (lat >= 9 && lat <= 29 && lng >= 92 && lng <= 101) {
    return {
      name: "Myanmar",
      locale: "my-MM",
      timezoneId: "Asia/Yangon",
      profileKey: "mm",
    };
  }

  // 🇧🇳 Brunei
  if (lat >= 4 && lat <= 6 && lng >= 114 && lng <= 116) {
    return {
      name: "Brunei",
      locale: "ms-BN",
      timezoneId: "Asia/Brunei",
      profileKey: "bn",
    };
  }

  // 🇹🇱 Timor-Leste
  if (lat >= -10 && lat <= -8 && lng >= 124 && lng <= 128) {
    return {
      name: "TimorLeste",
      locale: "pt-TL",
      timezoneId: "Asia/Dili",
      profileKey: "tl",
    };
  }

  // 🇯🇵 Japan
  if (lat >= 30 && lat <= 46 && lng >= 129 && lng <= 146) {
    return {
      name: "Japan",
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
      profileKey: "jp",
    };
  }

  // 🇺🇸 United States
  if (lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66) {
    return {
      name: "UnitedStates",
      locale: "en-US",
      timezoneId: "America/New_York",
      profileKey: "us",
    };
  }

  // 🇨🇦 Canada
  if (lat >= 42 && lat <= 83 && lng >= -141 && lng <= -52) {
    return {
      name: "Canada",
      locale: "en-CA",
      timezoneId: "America/Toronto",
      profileKey: "ca",
    };
  }

  // 🌍 Default
  return {
    name: "Global",
    locale: "en-US",
    timezoneId: "UTC",
    profileKey: "global",
  };
}