// Updated live-feed-service.ts
export interface LiveFeedService {
  channelId: string;
  name: string;
  groupTitle: string;
  logo?: string;
  channelNumber?: number;
  url: string;
  userAgent?: string;
  referrer?: string;
  manifestType?: string;
  licenseType?: string;
  licenseKey?: string;
}

export const liveFeedServices: LiveFeedService[] = [
  {
    channelId: "mjh-sky-popup2",
    name: "ThreeNow Sport 2",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/1jZRHmRhF6VFjZET4V2hFM/6d31709f4e877e133c3d16d28e1b58d2/Logo_Images_-_default.png",
    url: "https://i.mjh.nz/.r/sky-popup2.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-hgtv",
    name: "HGTV",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/7ln9bxKLUYx7i79iVBSREP/3728559763d31ce1a9484fb68db96ddc/Logo_Images_-_default.png",
    channelNumber: 19,
    url: "https://i.mjh.nz/.r/sky-hgtv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-ptcn",
    name: "CNN Headlines International",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/5xPXSNCtJNBngNLKZBGLXU/d3fa23fd249dd7c195fe69df9a49961a/Logo_Images_-_default.png",
    url: "https://i.mjh.nz/.r/sky-ptcn.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-ptms",
    name: "MovieSphere",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/4mdrvR6alGKw4BOn2sOnso/efe1f352f9ac767b86ed3ca3a1af2b62/Logo_Images_default.png",
    url: "https://i.mjh.nz/.r/sky-ptms.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-fast3",
    name: "Below Deck Vault",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/5Z2Ys82fuOd44NeA08xHcn/d5a345204a1bee6ff31f52bc85b0b593/Logo.png",
    url: "https://i.mjh.nz/.r/sky-fast3.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-ptmb",
    name: "MythBusters",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/7IE0yWc4kkOAOZD1Y2w9x6/c950f41e60d2d136c3a3bb4f6dd281f6/Logo_Images_-_default.png",
    url: "https://i.mjh.nz/.r/sky-ptmb.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-fast4",
    name: "Warner Bros TV True Crime",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/1gHJMQllMFrDalQ3o1yiBd/b223fc44c242254ebcda81101698527a/Logo_-_default.png",
    url: "https://i.mjh.nz/.r/sky-fast4.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-fast5",
    name: "Warner Bros TV Paranormal",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/6fSJzwOG5r7dfPc2uP4n7m/1e3923f6869c29300e3d76597c341282/Logo_Images_-_default.png",
    url: "https://i.mjh.nz/.r/sky-fast5.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-fast1",
    name: "Warner Bros TV Motorheads",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/laHWrOWVIUsYpUq2F7y0r/900f30b379ffadcdd49ea43ff83dc3d9/Logo_Images_-_default.png",
    url: "https://i.mjh.nz/.r/sky-fast1.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-fast2",
    name: "Warner Bros TV Deadliest Catch",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/4sdV9uGhLQRMYrBdMtGTNs/15a364e6a26ee48cff2979fa9f90bf51/Logo_-_default.png",
    url: "https://i.mjh.nz/.r/sky-fast2.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-fast6",
    name: "Warner Bros TV House Hunters",
    groupTitle: "Nz",
    logo: "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/7lHULtKhOa2XUCfUvXAvL5/23ce1169fbdbda0a219f6af3211b73eb/Logo_Images_-_default.png",
    url: "https://i.mjh.nz/.r/sky-fast6.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-mood-1290",
    name: "JuiceTV",
    groupTitle: "Nz",
    logo: "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1744244355255.png",
    channelNumber: 38,
    url: "https://i.mjh.nz/.r/mood-1290.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-mood-1289",
    name: "J2",
    groupTitle: "Nz",
    logo: "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1762940270646.png",
    url: "https://i.mjh.nz/.r/mood-1289.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-mood-1286",
    name: "Big Rig",
    groupTitle: "Nz",
    logo: "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1744244778333.png",
    url: "https://i.mjh.nz/.r/mood-1286.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-mood-1288",
    name: "Melo",
    groupTitle: "Nz",
    logo: "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1744280017572.png",
    url: "https://i.mjh.nz/.r/mood-1288.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-mood-1287",
    name: "The Groat",
    groupTitle: "Nz",
    logo: "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1743730111010.png",
    url: "https://i.mjh.nz/.r/mood-1287.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-tvnz-1",
    name: "TVNZ 1",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/tvnz-1.png",
    channelNumber: 1,
    url: "https://i.mjh.nz/.r/tvnz-1.mpd",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: "",
    manifestType: "mpd",
    licenseType: "com.widevine.alpha",
    licenseKey: "https://c.mjh.nz/tvnz-1-wv"
  },
  {
    channelId: "mjh-tvnz-2",
    name: "TVNZ 2",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/tvnz-2.png",
    channelNumber: 2,
    url: "https://i.mjh.nz/.r/tvnz-2.mpd",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: "",
    manifestType: "mpd",
    licenseType: "com.widevine.alpha",
    licenseKey: "https://c.mjh.nz/tvnz-2-wv"
  },
  {
    channelId: "mjh-three",
    name: "Three",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/three.png",
    channelNumber: 3,
    url: "https://i.mjh.nz/.r/three.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bravo",
    name: "Bravo",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/bravo.png",
    channelNumber: 4,
    url: "https://i.mjh.nz/.r/bravo.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-maori-tv",
    name: "Whakaata Maori",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/maori-tv.png",
    channelNumber: 5,
    url: "https://i.mjh.nz/.r/maori-tv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-tvnz-duke",
    name: "DUKE",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/tvnz-duke.png",
    channelNumber: 6,
    url: "https://i.mjh.nz/.r/tvnz-duke.mpd",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: "",
    manifestType: "mpd",
    licenseType: "com.widevine.alpha",
    licenseKey: "https://c.mjh.nz/tvnz-duke-wv"
  },
  {
    channelId: "mjh-prime",
    name: "Sky Open",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/sky-open.png",
    channelNumber: 8,
    url: "https://i.mjh.nz/.r/prime.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-rush-nz",
    name: "RUSH",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/rush-nz.png",
    channelNumber: 9,
    url: "https://i.mjh.nz/.r/rush-nz.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-te-reo",
    name: "Te Reo",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/te-reo.png",
    channelNumber: 10,
    url: "https://i.mjh.nz/.r/te-reo.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-three-plus1",
    name: "ThreePlus1",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/three-plus1.png",
    channelNumber: 13,
    url: "https://i.mjh.nz/.r/three-plus1.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bravo-plus1",
    name: "Bravo PLUS 1",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/bravo-plus1.png",
    channelNumber: 14,
    url: "https://i.mjh.nz/.r/bravo-plus1.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-eden",
    name: "eden",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/eden.png",
    channelNumber: 18,
    url: "https://i.mjh.nz/.r/eden.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-al-jazeera",
    name: "Al Jazeera",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/al-jazeera.png",
    channelNumber: 20,
    url: "https://i.mjh.nz/.r/al-jazeera.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-trackside-1",
    name: "Trackside 1",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/trackside-1.png",
    channelNumber: 23,
    url: "https://i.mjh.nz/.r/trackside-1.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-trackside-2",
    name: "Trackside 2",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/trackside-2.png",
    channelNumber: 24,
    url: "https://i.mjh.nz/.r/trackside-2.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-shine-tv",
    name: "Shine TV",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/shine-tv.png",
    channelNumber: 25,
    url: "https://c.mjh.nz/shine-tv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-firstlight",
    name: "Firstlight",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/firstlight.png",
    channelNumber: 26,
    url: "https://i.mjh.nz/.r/firstlight.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-hope-channel",
    name: "Hope Channel",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/hope-channel.png",
    channelNumber: 27,
    url: "https://i.mjh.nz/.r/hope-channel.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-parliament-tv",
    name: "Parliament TV",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/parliament-tv.png",
    channelNumber: 31,
    url: "https://i.mjh.nz/.r/parliament-tv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-wairarapa-tv",
    name: "Wairarapa TV",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/wairarapa-tv.png",
    channelNumber: 41,
    url: "https://i.mjh.nz/.r/wairarapa-tv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-ch200",
    name: "CH200",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/ch200.png",
    channelNumber: 200,
    url: "https://i.mjh.nz/.r/ch200.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-trackside-premier",
    name: "Trackside Premier",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/trackside-premier.png",
    url: "https://i.mjh.nz/.r/trackside-premier.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-tvsn-shopping",
    name: "TVSN Shopping",
    groupTitle: "Nz",
    logo: "https://i.mjh.nz/.images/tvsn-shopping.png",
    url: "https://i.mjh.nz/.r/tvsn-shopping.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-syd",
    name: "Seven",
    groupTitle: "Sydney",
    logo: "https://i.mjh.nz/.images/auto-seven-syd-9608a4.png",
    channelNumber: 71,
    url: "https://i.mjh.nz/.r/seven-syd.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7two-syd",
    name: "7two",
    groupTitle: "Sydney",
    logo: "https://i.mjh.nz/.images/auto-7two-syd-701123.png",
    channelNumber: 72,
    url: "https://i.mjh.nz/.r/7two-syd.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7mate-syd",
    name: "7mate",
    groupTitle: "Sydney",
    logo: "https://i.mjh.nz/.images/auto-7mate-syd-360d60.png",
    channelNumber: 74,
    url: "https://i.mjh.nz/.r/7mate-syd.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7flix-syd",
    name: "7flix",
    groupTitle: "Sydney",
    logo: "https://i.mjh.nz/.images/auto-7flix-syd-c6badc.png",
    channelNumber: 76,
    url: "https://i.mjh.nz/.r/7flix-syd.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-channel-9-nsw",
    name: "Channel 9",
    groupTitle: "Sydney",
    logo: "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png",
    channelNumber: 91,
    url: "https://i.mjh.nz/.r/channel-9-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-gem-nsw",
    name: "9Gem",
    groupTitle: "Sydney",
    logo: "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png",
    channelNumber: 92,
    url: "https://i.mjh.nz/.r/gem-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-go-nsw",
    name: "9Go!",
    groupTitle: "Sydney",
    logo: "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png",
    channelNumber: 93,
    url: "https://i.mjh.nz/.r/go-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-life-nsw",
    name: "9Life",
    groupTitle: "Sydney",
    logo: "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png",
    channelNumber: 94,
    url: "https://i.mjh.nz/.r/life-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-rush-nsw",
    name: "9Rush",
    groupTitle: "Sydney",
    logo: "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png",
    channelNumber: 96,
    url: "https://i.mjh.nz/.r/rush-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-channel-9-lismore",
    name: "Channel 9 (Norther Rivers)",
    groupTitle: "Sydney",
    logo: "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png",
    url: "https://i.mjh.nz/.r/channel-9-lismore.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-channel-9-newcastle",
    name: "Channel 9 (Newcastle)",
    groupTitle: "Sydney",
    logo: "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png",
    url: "https://i.mjh.nz/.r/channel-9-newcastle.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-nsw",
    name: "ABC TV",
    groupTitle: "Sydney",
    logo: "https://i.mjh.nz/.images/abc-nsw.png",
    channelNumber: 21,
    url: "https://c.mjh.nz/abc-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-nsw",
    name: "10",
    groupTitle: "Sydney",
    logo: "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png",
    channelNumber: 10,
    url: "https://i.mjh.nz/.r/10-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10bold-nsw",
    name: "10 Drama",
    groupTitle: "Sydney",
    logo: "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png",
    channelNumber: 12,
    url: "https://i.mjh.nz/.r/10bold-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10peach-nsw",
    name: "10 Comedy",
    groupTitle: "Sydney",
    logo: "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png",
    channelNumber: 11,
    url: "https://i.mjh.nz/.r/10peach-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10shake-nsw",
    name: "Nickelodeon",
    groupTitle: "Sydney",
    logo: "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png",
    channelNumber: 13,
    url: "https://i.mjh.nz/.r/10shake-nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-snowy-mountains",
    name: "Snowy Mountains Television",
    groupTitle: "Sydney",
    logo: "https://i.mjh.nz/.images/smtv.png",
    url: "https://i.mjh.nz/.r/snowy-mountains.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: "https://player.castr.com/"
  },
  {
    channelId: "mjh-seven-mel",
    name: "Seven",
    groupTitle: "Melbourne",
    logo: "https://i.mjh.nz/.images/auto-seven-mel-9608a4.png",
    channelNumber: 71,
    url: "https://i.mjh.nz/.r/seven-mel.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7two-mel",
    name: "7two",
    groupTitle: "Melbourne",
    logo: "https://i.mjh.nz/.images/auto-7two-mel-701123.png",
    channelNumber: 72,
    url: "https://i.mjh.nz/.r/7two-mel.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7mate-mel",
    name: "7mate",
    groupTitle: "Melbourne",
    logo: "https://i.mjh.nz/.images/auto-7mate-mel-360d60.png",
    channelNumber: 74,
    url: "https://i.mjh.nz/.r/7mate-mel.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7flix-mel",
    name: "7flix",
    groupTitle: "Melbourne",
    logo: "https://i.mjh.nz/.images/auto-7flix-mel-c6badc.png",
    channelNumber: 76,
    url: "https://i.mjh.nz/.r/7flix-mel.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-channel-9-vic",
    name: "Channel 9",
    groupTitle: "Melbourne",
    logo: "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png",
    channelNumber: 91,
    url: "https://i.mjh.nz/.r/channel-9-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-gem-vic",
    name: "9Gem",
    groupTitle: "Melbourne",
    logo: "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png",
    channelNumber: 92,
    url: "https://i.mjh.nz/.r/gem-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-go-vic",
    name: "9Go!",
    groupTitle: "Melbourne",
    logo: "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png",
    channelNumber: 93,
    url: "https://i.mjh.nz/.r/go-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-life-vic",
    name: "9Life",
    groupTitle: "Melbourne",
    logo: "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png",
    channelNumber: 94,
    url: "https://i.mjh.nz/.r/life-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-rush-vic",
    name: "9Rush",
    groupTitle: "Melbourne",
    logo: "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png",
    channelNumber: 96,
    url: "https://i.mjh.nz/.r/rush-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-vic",
    name: "ABC TV",
    groupTitle: "Melbourne",
    logo: "https://i.mjh.nz/.images/abc-nsw.png",
    channelNumber: 21,
    url: "https://c.mjh.nz/abc-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-vic",
    name: "10",
    groupTitle: "Melbourne",
    logo: "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png",
    channelNumber: 10,
    url: "https://i.mjh.nz/.r/10-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10bold-vic",
    name: "10 Drama",
    groupTitle: "Melbourne",
    logo: "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png",
    channelNumber: 12,
    url: "https://i.mjh.nz/.r/10bold-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10peach-vic",
    name: "10 Comedy",
    groupTitle: "Melbourne",
    logo: "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png",
    channelNumber: 11,
    url: "https://i.mjh.nz/.r/10peach-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10shake-vic",
    name: "Nickelodeon",
    groupTitle: "Melbourne",
    logo: "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png",
    channelNumber: 13,
    url: "https://i.mjh.nz/.r/10shake-vic.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-c31",
    name: "Channel 31",
    groupTitle: "Melbourne",
    logo: "https://i.mjh.nz/.images/c31.png",
    channelNumber: 44,
    url: "https://i.mjh.nz/.r/c31.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-bri",
    name: "Seven",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-seven-bri-9608a4.png",
    channelNumber: 71,
    url: "https://i.mjh.nz/.r/seven-bri.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7two-bri",
    name: "7two",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-7two-bri-701123.png",
    channelNumber: 72,
    url: "https://i.mjh.nz/.r/7two-bri.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7mate-bri",
    name: "7mate",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-7mate-bri-360d60.png",
    channelNumber: 74,
    url: "https://i.mjh.nz/.r/7mate-bri.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7flix-bri",
    name: "7flix",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-7flix-bri-c6badc.png",
    channelNumber: 76,
    url: "https://i.mjh.nz/.r/7flix-bri.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-cns",
    name: "Seven Cairns",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-seven-cns-9608a4.png",
    url: "https://i.mjh.nz/.r/seven-cns.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7flix-regional",
    name: "7flix Regional",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-7flix-regional-c6badc.png",
    url: "https://i.mjh.nz/.r/7flix-regional.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7two-regional",
    name: "7two Regional",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-7two-regional-701123.png",
    url: "https://i.mjh.nz/.r/7two-regional.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7mate-regional",
    name: "7mate Regional",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-7mate-regional-360d60.png",
    url: "https://i.mjh.nz/.r/7mate-regional.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-mky",
    name: "Seven Mackay",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-seven-mky-9608a4.png",
    url: "https://i.mjh.nz/.r/seven-mky.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-ssc",
    name: "Seven Sunshine Coast",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-seven-ssc-9608a4.png",
    url: "https://i.mjh.nz/.r/seven-ssc.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-rky",
    name: "Seven Rockhampton",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-seven-rky-9608a4.png",
    url: "https://i.mjh.nz/.r/seven-rky.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-twb",
    name: "Seven Toowoomba",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-seven-twb-e627be.png",
    url: "https://i.mjh.nz/.r/seven-twb.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-tsv",
    name: "Seven Townsville",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-seven-tsv-9608a4.png",
    url: "https://i.mjh.nz/.r/seven-tsv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-wby",
    name: "Seven Wide Bay",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/auto-seven-wby-9608a4.png",
    url: "https://i.mjh.nz/.r/seven-wby.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-channel-9-qld",
    name: "Channel 9",
    groupTitle: "Brisbane",
    logo: "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png",
    channelNumber: 91,
    url: "https://i.mjh.nz/.r/channel-9-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-gem-qld",
    name: "9Gem",
    groupTitle: "Brisbane",
    logo: "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png",
    channelNumber: 92,
    url: "https://i.mjh.nz/.r/gem-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-go-qld",
    name: "9Go!",
    groupTitle: "Brisbane",
    logo: "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png",
    channelNumber: 93,
    url: "https://i.mjh.nz/.r/go-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-life-qld",
    name: "9Life",
    groupTitle: "Brisbane",
    logo: "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png",
    channelNumber: 94,
    url: "https://i.mjh.nz/.r/life-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-rush-qld",
    name: "9Rush",
    groupTitle: "Brisbane",
    logo: "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png",
    channelNumber: 96,
    url: "https://i.mjh.nz/.r/rush-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-channel-9-gold-coast",
    name: "Channel 9 (Gold Coast)",
    groupTitle: "Brisbane",
    logo: "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png",
    url: "https://i.mjh.nz/.r/channel-9-gold-coast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-qld",
    name: "ABC TV",
    groupTitle: "Brisbane",
    logo: "https://i.mjh.nz/.images/abc-nsw.png",
    channelNumber: 21,
    url: "https://c.mjh.nz/abc-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-qld",
    name: "10",
    groupTitle: "Brisbane",
    logo: "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png",
    channelNumber: 10,
    url: "https://i.mjh.nz/.r/10-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10bold-qld",
    name: "10 Drama",
    groupTitle: "Brisbane",
    logo: "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png",
    channelNumber: 12,
    url: "https://i.mjh.nz/.r/10bold-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10peach-qld",
    name: "10 Comedy",
    groupTitle: "Brisbane",
    logo: "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png",
    channelNumber: 11,
    url: "https://i.mjh.nz/.r/10peach-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10shake-qld",
    name: "Nickelodeon",
    groupTitle: "Brisbane",
    logo: "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png",
    channelNumber: 13,
    url: "https://i.mjh.nz/.r/10shake-qld.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-per",
    name: "Seven",
    groupTitle: "Perth",
    logo: "https://i.mjh.nz/.images/auto-seven-per-9608a4.png",
    channelNumber: 71,
    url: "https://i.mjh.nz/.r/seven-per.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7two-per",
    name: "7two",
    groupTitle: "Perth",
    logo: "https://i.mjh.nz/.images/auto-7two-per-701123.png",
    channelNumber: 72,
    url: "https://i.mjh.nz/.r/7two-per.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7mate-per",
    name: "7mate",
    groupTitle: "Perth",
    logo: "https://i.mjh.nz/.images/auto-7mate-per-360d60.png",
    channelNumber: 74,
    url: "https://i.mjh.nz/.r/7mate-per.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7flix-per",
    name: "7flix",
    groupTitle: "Perth",
    logo: "https://i.mjh.nz/.images/auto-7flix-per-c6badc.png",
    channelNumber: 76,
    url: "https://i.mjh.nz/.r/7flix-per.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-channel-9-wa",
    name: "Channel 9",
    groupTitle: "Perth",
    logo: "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png",
    channelNumber: 91,
    url: "https://i.mjh.nz/.r/channel-9-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-gem-wa",
    name: "9Gem",
    groupTitle: "Perth",
    logo: "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png",
    channelNumber: 92,
    url: "https://i.mjh.nz/.r/gem-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-go-wa",
    name: "9Go!",
    groupTitle: "Perth",
    logo: "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png",
    channelNumber: 93,
    url: "https://i.mjh.nz/.r/go-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-life-wa",
    name: "9Life",
    groupTitle: "Perth",
    logo: "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png",
    channelNumber: 94,
    url: "https://i.mjh.nz/.r/life-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-rush-wa",
    name: "9Rush",
    groupTitle: "Perth",
    logo: "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png",
    channelNumber: 96,
    url: "https://i.mjh.nz/.r/rush-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-wa",
    name: "ABC TV",
    groupTitle: "Perth",
    logo: "https://i.mjh.nz/.images/abc-nsw.png",
    channelNumber: 21,
    url: "https://c.mjh.nz/abc-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-wa",
    name: "10",
    groupTitle: "Perth",
    logo: "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png",
    channelNumber: 10,
    url: "https://i.mjh.nz/.r/10-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10bold-wa",
    name: "10 Drama",
    groupTitle: "Perth",
    logo: "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png",
    channelNumber: 12,
    url: "https://i.mjh.nz/.r/10bold-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10peach-wa",
    name: "10 Comedy",
    groupTitle: "Perth",
    logo: "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png",
    channelNumber: 11,
    url: "https://i.mjh.nz/.r/10peach-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10shake-wa",
    name: "Nickelodeon",
    groupTitle: "Perth",
    logo: "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png",
    channelNumber: 13,
    url: "https://i.mjh.nz/.r/10shake-wa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-ade",
    name: "Seven",
    groupTitle: "Adelaide",
    logo: "https://i.mjh.nz/.images/auto-seven-ade-9608a4.png",
    channelNumber: 71,
    url: "https://i.mjh.nz/.r/seven-ade.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7two-ade",
    name: "7two",
    groupTitle: "Adelaide",
    logo: "https://i.mjh.nz/.images/auto-7two-ade-701123.png",
    channelNumber: 72,
    url: "https://i.mjh.nz/.r/7two-ade.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7mate-ade",
    name: "7mate",
    groupTitle: "Adelaide",
    logo: "https://i.mjh.nz/.images/auto-7mate-ade-360d60.png",
    channelNumber: 74,
    url: "https://i.mjh.nz/.r/7mate-ade.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7flix-ade",
    name: "7flix",
    groupTitle: "Adelaide",
    logo: "https://i.mjh.nz/.images/auto-7flix-ade-c6badc.png",
    channelNumber: 76,
    url: "https://i.mjh.nz/.r/7flix-ade.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-channel-9-sa",
    name: "Channel 9",
    groupTitle: "Adelaide",
    logo: "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png",
    channelNumber: 91,
    url: "https://i.mjh.nz/.r/channel-9-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-gem-sa",
    name: "9Gem",
    groupTitle: "Adelaide",
    logo: "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png",
    channelNumber: 92,
    url: "https://i.mjh.nz/.r/gem-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-go-sa",
    name: "9Go!",
    groupTitle: "Adelaide",
    logo: "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png",
    channelNumber: 93,
    url: "https://i.mjh.nz/.r/go-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-life-sa",
    name: "9Life",
    groupTitle: "Adelaide",
    logo: "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png",
    channelNumber: 94,
    url: "https://i.mjh.nz/.r/life-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-rush-sa",
    name: "9Rush",
    groupTitle: "Adelaide",
    logo: "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png",
    channelNumber: 96,
    url: "https://i.mjh.nz/.r/rush-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-sa",
    name: "ABC TV",
    groupTitle: "Adelaide",
    logo: "https://i.mjh.nz/.images/abc-nsw.png",
    channelNumber: 21,
    url: "https://c.mjh.nz/abc-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-sa",
    name: "10",
    groupTitle: "Adelaide",
    logo: "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png",
    channelNumber: 10,
    url: "https://i.mjh.nz/.r/10-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10bold-sa",
    name: "10 Drama",
    groupTitle: "Adelaide",
    logo: "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png",
    channelNumber: 12,
    url: "https://i.mjh.nz/.r/10bold-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10peach-sa",
    name: "10 Comedy",
    groupTitle: "Adelaide",
    logo: "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png",
    channelNumber: 11,
    url: "https://i.mjh.nz/.r/10peach-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10shake-sa",
    name: "Nickelodeon",
    groupTitle: "Adelaide",
    logo: "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png",
    channelNumber: 13,
    url: "https://i.mjh.nz/.r/10shake-sa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-c44",
    name: "Channel 44",
    groupTitle: "Adelaide",
    logo: "https://i.mjh.nz/.images/c44.png",
    channelNumber: 44,
    url: "https://i.mjh.nz/.r/c44.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-act",
    name: "ABC TV",
    groupTitle: "Canberra",
    logo: "https://i.mjh.nz/.images/abc-nsw.png",
    channelNumber: 21,
    url: "https://c.mjh.nz/abc-act.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-nt",
    name: "ABC TV",
    groupTitle: "Darwin",
    logo: "https://i.mjh.nz/.images/abc-nsw.png",
    channelNumber: 21,
    url: "https://c.mjh.nz/abc-nt.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-first-nations-tv",
    name: "First Nations TV",
    groupTitle: "Darwin",
    logo: "https://i.mjh.nz/.images/first-nations-tv.png",
    channelNumber: 41,
    url: "https://i.mjh.nz/.r/first-nations-tv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-tourism-tv",
    name: "Tourism TV",
    groupTitle: "Darwin",
    logo: "https://i.mjh.nz/.images/tourism-tv.png",
    channelNumber: 42,
    url: "https://i.mjh.nz/.r/tourism-tv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seven-hob",
    name: "Seven",
    groupTitle: "Hobart",
    logo: "https://i.mjh.nz/.images/auto-seven-hob-9608a4.png",
    channelNumber: 71,
    url: "https://i.mjh.nz/.r/seven-hob.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-tas",
    name: "ABC TV",
    groupTitle: "Hobart",
    logo: "https://i.mjh.nz/.images/abc-nsw.png",
    channelNumber: 21,
    url: "https://c.mjh.nz/abc-tas.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bordersecurityaustralia-fast",
    name: "Border Security Australia",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-bordersecurityaustralia-fast-30b210.png",
    url: "https://i.mjh.nz/.r/bordersecurityaustralia-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-racing-fast",
    name: "Racing.com",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-racing-fast-de6aee.png",
    channelNumber: 78,
    url: "https://i.mjh.nz/.r/racing-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-hardcorepawn-fast",
    name: "Hardcore Pawn",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-hardcorepawn-fast-87f8ee.png",
    url: "https://i.mjh.nz/.r/hardcorepawn-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-racingwa-fast",
    name: "Racing WA",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-racingwa-fast-128220.png",
    url: "https://i.mjh.nz/.r/racingwa-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-allsaints-fast",
    name: "All Saints",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-allsaints-fast-ebad23.png",
    url: "https://i.mjh.nz/.r/allsaints-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-mythbusters-fast",
    name: "Mythbusters",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-mythbusters-fast-3a72b1.png",
    url: "https://i.mjh.nz/.r/mythbusters-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-travelaustralia-fast",
    name: "Travel Australia",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-travelaustralia-fast-cfd556.png",
    url: "https://i.mjh.nz/.r/travelaustralia-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-aircrashinvestigations-fast",
    name: "Air Crash Investigations",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-aircrashinvestigations-fast-7ff35e.png",
    url: "https://i.mjh.nz/.r/aircrashinvestigations-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-betterhomesandgardens-fast",
    name: "Better Homes And Gardens",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-betterhomesandgardens-fast-8d1753.png",
    url: "https://i.mjh.nz/.r/betterhomesandgardens-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-cas33-fast",
    name: "The Yorkshire Vet",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-cas33-fast-7aec74.png",
    url: "https://i.mjh.nz/.r/cas33-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-csicrimesceneinvestigation-fast",
    name: "CSI Crime Scene Investigation",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-csicrimesceneinvestigation-fast-87549e.png",
    url: "https://i.mjh.nz/.r/csicrimesceneinvestigation-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-mightymachines-fast",
    name: "Mighty Machines",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-mightymachines-fast-0fa14e.png",
    url: "https://i.mjh.nz/.r/mightymachines-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-cas21-fast",
    name: "Ghost Hunters",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-cas21-fast-f940a9.png",
    url: "https://i.mjh.nz/.r/cas21-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-onthecase-fast",
    name: "On The Case",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-onthecase-fast-6ec172.png",
    url: "https://i.mjh.nz/.r/onthecase-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-cas24-fast",
    name: "Bondi Vet",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-cas24-fast-b9e819.png",
    url: "https://i.mjh.nz/.r/cas24-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-cas26-fast",
    name: "Home and Away Classics",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-cas26-fast-ea7944.png",
    url: "https://i.mjh.nz/.r/cas26-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-livgolfreplays-fast",
    name: "LIV Golf Replays",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-livgolfreplays-fast-471f30.png",
    url: "https://i.mjh.nz/.r/livgolfreplays-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-waterrats-fast",
    name: "Water Rats",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-waterrats-fast-428228.png",
    url: "https://i.mjh.nz/.r/waterrats-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7afl-fast",
    name: "7AFL",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-7afl-fast-e8fdb6.png",
    url: "https://i.mjh.nz/.r/7afl-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-cas32-fast",
    name: "7NEWS Spotlight",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-cas32-fast-2bc14f.png",
    url: "https://i.mjh.nz/.r/cas32-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-wtn-fast",
    name: "Wicked Tuna",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-wtn-fast-0a858d.png",
    url: "https://i.mjh.nz/.r/wtn-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-winnersnlosers-fast",
    name: "Winners & Losers",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-winnersnlosers-fast-a59958.png",
    url: "https://i.mjh.nz/.r/winnersnlosers-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-surveillancecentral-fast",
    name: "Surveillance Central",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-surveillancecentral-fast-4eeefa.png",
    url: "https://i.mjh.nz/.r/surveillancecentral-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-outbacktruckers-fast",
    name: "Outback Truckers",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-outbacktruckers-fast-332b21.png",
    url: "https://i.mjh.nz/.r/outbacktruckers-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-anglersparadise-fast",
    name: "Anglers Paradise",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-anglersparadise-fast-970ebb.png",
    url: "https://i.mjh.nz/.r/anglersparadise-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-truckinghell-fast",
    name: "Trucking Hell",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-truckinghell-fast-6b08c1.png",
    url: "https://i.mjh.nz/.r/truckinghell-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-judgejudy-fast",
    name: "Judge Judy",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-judgejudy-fast-8781e8.png",
    url: "https://i.mjh.nz/.r/judgejudy-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-all-starcinema-fast",
    name: "All-Star Cinema",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-all-starcinema-fast-9f2397.png",
    url: "https://i.mjh.nz/.r/all-starcinema-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bluelight-fast",
    name: "Blue Light",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-bluelight-fast-dc5718.png",
    url: "https://i.mjh.nz/.r/bluelight-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-medicalnrescue-fast",
    name: "Medical And Rescue",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-medicalnrescue-fast-bd9388.png",
    url: "https://i.mjh.nz/.r/medicalnrescue-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-blueheelers-fast",
    name: "Blue Heelers",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-blueheelers-fast-8cc89d.png",
    url: "https://i.mjh.nz/.r/blueheelers-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-kitchennightmares-fast",
    name: "Kitchen Nightmares",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-kitchennightmares-fast-ba1ad2.png",
    url: "https://i.mjh.nz/.r/kitchennightmares-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-acountrypractice-fast",
    name: "A Country Practice",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-acountrypractice-fast-3f02ad.png",
    url: "https://i.mjh.nz/.r/acountrypractice-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-truecrimefiles-fast",
    name: "True Crime Files",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-truecrimefiles-fast-26e3bf.png",
    url: "https://i.mjh.nz/.r/truecrimefiles-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-art-fast",
    name: "Antiques Road Trip",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-art-fast-99c60f.png",
    url: "https://i.mjh.nz/.r/art-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-7bravo-fast",
    name: "7Bravo",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-7bravo-fast-04647e.png",
    channelNumber: 75,
    url: "https://i.mjh.nz/.r/7bravo-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-heki-fast",
    name: "Hells Kitchen",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-heki-fast-6f7c4d.png",
    url: "https://i.mjh.nz/.r/heki-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-belowdeckvault-fast",
    name: "Below Deck Vault",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-belowdeckvault-fast-587793.png",
    url: "https://i.mjh.nz/.r/belowdeckvault-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-tvsn-fast",
    name: "TVSN",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-tvsn-fast-eda516.png",
    channelNumber: 77,
    url: "https://i.mjh.nz/.r/tvsn-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-etc-fast",
    name: "Escape to the Country",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-etc-fast-6d4429.png",
    url: "https://i.mjh.nz/.r/etc-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-therealhousewivesvault-fast",
    name: "The Real Housewives VAULT",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-therealhousewivesvault-fast-dd8ea5.png",
    url: "https://i.mjh.nz/.r/therealhousewivesvault-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-cricketgold-fast",
    name: "Cricket Gold",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-cricketgold-fast-906f03.png",
    url: "https://i.mjh.nz/.r/cricketgold-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-botchedvault-fast",
    name: "Botched VAULT",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-botchedvault-fast-4c6012.png",
    url: "https://i.mjh.nz/.r/botchedvault-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-ncis-fast",
    name: "NCIS",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-ncis-fast-6f82bd.png",
    url: "https://i.mjh.nz/.r/ncis-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-cas39-fast",
    name: "24 Hours in A&E",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-cas39-fast-aa22c1.png",
    url: "https://i.mjh.nz/.r/cas39-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-cas40-fast",
    name: "Million Dollar Listing VAULT",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-cas40-fast-0b72b7.png",
    url: "https://i.mjh.nz/.r/cas40-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-cas41-fast",
    name: "Bondi Rescue",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/auto-cas41-fast-a6b151.png",
    url: "https://i.mjh.nz/.r/cas41-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-seinfeld-fast",
    name: "Seinfeld",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/yKlUxIHgYC5cpCmL1DYpRCQ6w4o=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585342%2Fgroup-61657.png",
    url: "https://i.mjh.nz/.r/seinfeld-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-9crime-fast",
    name: "9Crime",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/OwBWBtMcLMF5vBP09k6w4LneJQM=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585343%2Fgroup-61566.png",
    url: "https://i.mjh.nz/.r/9crime-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-the-block-247-fast",
    name: "The Block 24/7",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/Mj-NaVq7oZgtzt2bf55lkLIfyuQ=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F623508%2Ftheblock_squircle.png",
    url: "https://i.mjh.nz/.r/the-block-247-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-taronga-247-fast",
    name: "Taronga 24/7",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/HvEyaXfq57tpzSGiLjqejGDiyA8=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2026%2F06%2F779914%2Ftaronga_squircle.png",
    url: "https://i.mjh.nz/.r/taronga-247-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bbc-news-fast",
    name: "BBC News",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/85c0UKHMSSRPXJ2MJ2PXqvUcXok=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2026%2F03%2F763537%2Fbbc_squircle.png",
    url: "https://i.mjh.nz/.r/bbc-news-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-9mysteryparanormal-fast",
    name: "9Mystery&Paranormal",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/1l9r5t0Fkyry61l_5eKpIxtv0SE=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2025%2F04%2F685323%2Fmp_squircle.png",
    url: "https://i.mjh.nz/.r/9mysteryparanormal-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-married-at-first-sight-fast",
    name: "Married At First Sight",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/OCF69HZLp4AWm0cGB8bvgx4U8mQ=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585176%2Fsquircle_mafs.png",
    url: "https://i.mjh.nz/.r/married-at-first-sight-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bbc-top-gear-247-fast",
    name: "BBC Top Gear",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/anIncnAgaLBmeroZtHqBIXHpW6c=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F11%2F648316%2Fgroup-61773.png",
    url: "https://i.mjh.nz/.r/bbc-top-gear-247-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-dance-moms-247-fast",
    name: "Dance Moms 24/7",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/OKBRw5HKp9hAAVX3XM-A1HrVRug=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585178%2Fsquircle_dancemoms.png",
    url: "https://i.mjh.nz/.r/dance-moms-247-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-lmn-fast",
    name: "LMN",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/GfA3WNoMOfZbJOqJeq-UrX5nsdk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F12%2F658518%2Fgroup-61484.png",
    url: "https://i.mjh.nz/.r/lmn-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-real-emergency-fast",
    name: "Real Emergency",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/mEHWZZQZMecm6LaCcdOvOqgSn0Q=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2025%2F10%2F726130%2Frealemergencysquircle.png",
    url: "https://i.mjh.nz/.r/real-emergency-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-h2-fast",
    name: "H2",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/OxADVUkSO8Xp2ATCSJmMsa0gcDE=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2025%2F04%2F684622%2Fh2_squircle.png",
    url: "https://i.mjh.nz/.r/h2-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-60-minutes-australia-fast",
    name: "60 Minutes Australia",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/kufGcZyXI7lNm32WrMV86xPNAnk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585173%2Fsquircle_60mins.png",
    url: "https://i.mjh.nz/.r/60-minutes-australia-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bbc-antiques-roadshow-247-fast",
    name: "BBC Antiques Roadshow",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/zRjEXK-6iFh-92EKnAZN9rXREkA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F11%2F648315%2Fgroup-61774.png",
    url: "https://i.mjh.nz/.r/bbc-antiques-roadshow-247-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bbc-comedy-fast",
    name: "BBC Comedy",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/2bl6ZyviwjpHCeVoXf8twpEVFjo=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F11%2F648314%2Fgroup-61772.png",
    url: "https://i.mjh.nz/.r/bbc-comedy-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bbc-home-garden-fast",
    name: "BBC Home & Garden",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/RHsGPvwhtEktqfW-Tg4ygRMy1ug=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F11%2F648313%2Fgroup-61771.png",
    url: "https://i.mjh.nz/.r/bbc-home-garden-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bbc-food-fast",
    name: "BBC Food",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/fsW8mo_8BA8nztvHgpodxtSmcjo=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F12%2F652517%2Fgroup-61812.png",
    url: "https://i.mjh.nz/.r/bbc-food-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-wnbl-202627-fast",
    name: "WNBL 2026/27",
    groupTitle: "Au",
    logo: "https://imageresizer.static9.net.au/SBz7DKoMTTXJvmj-XGrjU093es0=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2026%2F10%2F800206%2Fwnbl_squircle.png",
    url: "https://i.mjh.nz/.r/wnbl-202627-fast.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-grahamnorton",
    name: "The Graham Norton Show",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2023/07/12/bcb38e1591564d24894210f4abd02423-1248623.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-grahamnorton.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-mtv-the-shores",
    name: "MTV The Shores",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2023/07/11/3901f5c4522a0c36cfed8630ab781a5e-1248401.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-mtv-the-shores.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-thankgodyourehere",
    name: "Thank God You're Here",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2025/08/19/9cde4af8ad28a81defc2e020775ff74f-1390978.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-thankgodyourehere.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-diagnosismurder",
    name: "Diagnosis Murder",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2023/06/28/5f85fc3d794a167630b935cb639abcc3-1246005.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-diagnosismurder.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-becker",
    name: "Becker",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2023/06/28/e0449ed804aaacb1de64f87d94912dd3-1246030.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-becker.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-eightoutof10cats",
    name: "8 Out Of 10 Cats",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/11/18/03a9b9a1a42bcf2ce1bbb94a8fa47224-1350731.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-eightoutof10cats.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-mtvridiculousness",
    name: "MTV Ridiculousness",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/02/19/6a7d740896d031b59c9d33d0e6dff544-1298686.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-mtvridiculousness.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-haveyoubeenpayingattention",
    name: "Have You Been Paying Attention?",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/12/17/20963e84ceedc64212b60c21c883e5c4-1356262.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-haveyoubeenpayingattention.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-cheapseats",
    name: "The Cheap Seats",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2025/08/08/47006754904d1d36520e76157ecbfb41-1390280.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-cheapseats.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-adultanimation",
    name: "Adult Animation",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/03/21/fb3a87d8a0126b81727106f43c2a2aef-1304705.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-adultanimation.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-aussiedramapopup",
    name: "Rush",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2023/01/24/082f00086b990e915cd774644d67484c-1213111.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-aussiedramapopup.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-rookieblue",
    name: "rookie-blue",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2026/02/01/b4f014a58a872ecca3409d233c38f122-1408366.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-rookieblue.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-heartland",
    name: "Heartland",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2026/02/01/8b5e285428d559ef6e3afdeebfe53a5d-1408387.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-heartland.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-prisoner-cell-block-h",
    name: "Prisoner: Cell Block H",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2022/09/26/b6430b0f79d6b4c9fc5c6ea295bbae03-1182444.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-prisoner-cell-block-h.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-dallascheerleaders",
    name: "Dallas Cowboy Cheerleaders: Making The Team",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2026/10/13/0908d845bb84c3146f50501d394ca2a6-1466626.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-dallascheerleaders.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-nexttopmodel",
    name: "Next Top Model",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2026/08/04/7b46b0620b6c96c6afcd7c47bf356f79-1448048.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-nexttopmodel.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-projectrunway",
    name: "Project Runway",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2025/03/18/9652b72f62d4dcb715e22ec6f972b1e7-1369332.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-projectrunway.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-masterchef",
    name: "MasterChef",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2022/09/02/3fff1b47f7c01770b7f0f319770d5362-1177252.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-masterchef.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-world-of-survivor",
    name: "World Of Survivor",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/09/24/6a7955dee63fad795d40332b9cfbf8ce-1340644.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-world-of-survivor.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-judge-judy",
    name: "Judge Judy",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2022/09/02/461008ac0d02137f713ec0e4883be6c4-1177265.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-judge-judy.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-theonlywayisessex",
    name: "The Only Way Is Essex",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/10/21/644463c986545838587c1b800be3da68-1345463.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-theonlywayisessex.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-undercoverboss",
    name: "Undercover Boss",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/10/21/45e53866fa7cd6757ddf34e52e7a9262-1345397.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-undercoverboss.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-hardcorepawn",
    name: "Hardcore Pawn",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2025/03/03/1d46b70035ba5c816af46c6d4ee079cd-1366514.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-hardcorepawn.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-wicked-tuna",
    name: "Wicked Tuna",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2022/09/02/2d667eb54bf0119b84b744f9569ee214-1177247.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-wicked-tuna.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-embarrassing-bodies",
    name: "Embarrassing Bodies",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/10/21/f315a8cda9494cc30e29fdba87430ff8-1345391.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-embarrassing-bodies.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-highwaythruhell",
    name: "Highway Thru Hell",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2025/06/19/3c941c6bd357c1bc3acc855f846e842c-1383806.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-highwaythruhell.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-cops",
    name: "COPS",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2025/03/30/6fadf0873ac36ecacdc63ed8bba4cf3d-1371071.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-cops.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-medical-emergency",
    name: "Medical Emergency",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2023/06/28/115b6796134f1e983f41c224c31cc7c9-1246084.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-medical-emergency.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-deadlywomen",
    name: "Deadly Women",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2025/06/19/01e576c63918373cd03aa21ea8566f1e-1383812.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-deadlywomen.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-crime-time",
    name: "Crime Time",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/09/25/c27b803a4128c5b097cd3a23e1be973c-1341004.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-crime-time.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-crime-hunters",
    name: "Crime Hunters",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/03/06/cb69de15e7b8989a218ad25b7f6547ef-1301820.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-crime-hunters.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-forty-eight-hours",
    name: "48 Hours",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2023/06/28/7dd910de29f31095b69e17f1da8f3f0e-1245997.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-forty-eight-hours.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-true-stories",
    name: "True Stories",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2022/09/22/bf31efb3f5efe008cc774909b0cef282-1181809.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-true-stories.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-haunt-tv",
    name: "Haunt TV",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2023/07/12/8cb62aeb9de0e12611b68059325da0f3-1248632.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-haunt-tv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-ghosthunters",
    name: "Ghost Hunters",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/02/20/6a0f5d5002748886ee7b1936f996a304-1298978.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-ghosthunters.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-jamieoliver",
    name: "Jamie Oliver",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2026/10/05/f56ba740d7edd193360ff0e4cdba004b-1465603.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-jamieoliver.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-anthonybourdain",
    name: "Anthony Bourdain: Parts Unknown",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2025/05/26/cbf83588f02110ded81566ecc62e2f0e-1380501.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-anthonybourdain.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-wildest",
    name: "Wildest",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2026/04/28/230f46ab9b55bdb4f98a00f616d8b0a2-1424324.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-wildest.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-shockwave",
    name: "Shockwave",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2026/03/31/145f61f54f2e66b3bf4a2fefff5b267a-1421437.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-shockwave.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-historyandwarfare",
    name: "History & Warfare",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2026/03/17/5010fc64782edb4842a94d1484f72514-1419388.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-historyandwarfare.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-seasonalmovies",
    name: "Thriller Movies",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/04/01/86e45216ee9df7d873e393dccb379d94-1306209.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-seasonalmovies.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-moviesphere",
    name: "Moviesphere",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2022/12/05/6bb229de8fcf96e206e99ca455fc2267-1202912.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-moviesphere.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-nick-jr",
    name: "Nick Jr Club",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/06/06/d14509f218578984e3a6f6f34f0ee12c-1319009.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-nick-jr.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-spongebobsquarepants",
    name: "SpongeBob SquarePants",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/05/27/ee4d9694aa3f7a2fe97b6f18aa773b88-1316803.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-spongebobsquarepants.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-nicktoons",
    name: "NickToons",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/06/04/f2f7c4166d8450351c2ae5d8b28c769e-1318512.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-nicktoons.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-nicktoons-90s",
    name: "NickToons 90s",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/06/07/a1aaf63737e7d2076759dd850b58471a-1319376.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-nicktoons-90s.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-nickteen",
    name: "NickTeen",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/06/04/ecc540be818b29d753e036e046028a27-1318595.png?image-profile=logo",
    url: "https://i.mjh.nz/.r/10-nickteen.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-geckotv",
    name: "Gecko TV",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2023/02/23/b81bfc3f4737696257ef326b0e68208e-1219777.png?image-profile=logo",
    channelNumber: 17,
    url: "https://i.mjh.nz/.r/10-geckotv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-10-youtv",
    name: "YouTV",
    groupTitle: "Au",
    logo: "https://10.com.au/ip/s3/2024/07/10/33f7c16e8ba1628d52844cb45b8eac4f-1326074.png?image-profile=logo",
    channelNumber: 16,
    url: "https://i.mjh.nz/.r/10-youtv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sbst",
    name: "SBS",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/b073959a-a63e-5b6a-a05a-157d615a4b8c",
    channelNumber: 30,
    url: "https://i.mjh.nz/.r/sbs-sbst.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-2syd",
    name: "SBS2",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/e7f27bb4-4672-599e-b9b4-a72cfdd8d3ba",
    channelNumber: 31,
    url: "https://i.mjh.nz/.r/sbs-2syd.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-3syd",
    name: "SBS Food",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/336c48bb-129d-5348-9d2f-63ab4fe6d493",
    channelNumber: 33,
    url: "https://i.mjh.nz/.r/sbs-3syd.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-5nsw",
    name: "NITV",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/00ff96cd-68c3-5219-b792-c0c2faec1fe6",
    channelNumber: 34,
    url: "https://i.mjh.nz/.r/sbs-5nsw.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-4syd",
    name: "SBS World Movies",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/cc42ae9e-0e64-5bc3-8c71-6f23f42610fb",
    channelNumber: 32,
    url: "https://i.mjh.nz/.r/sbs-4syd.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sb04",
    name: "Koori Knockout",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/241574b9-51a2-55a5-bef8-a555021dd833",
    url: "https://i.mjh.nz/.r/sbs-sb04.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-france24",
    name: "France 24",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/940bda61-531e-5e30-bb1e-69db1cdbb077",
    url: "https://i.mjh.nz/.r/sbs-france24.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-euronews",
    name: "euronews",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/60e599d9-82ed-5eac-b51c-7c23a9bb0c55",
    url: "https://i.mjh.nz/.r/sbs-euronews.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sb02",
    name: "Insight",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/ac68f57a-4655-5dc2-b17e-2ca3505e5e6c",
    url: "https://i.mjh.nz/.r/sbs-sb02.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sb03",
    name: "Dateline",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/8664060f-f5f6-598d-8d6a-8f7f59bc91c1",
    url: "https://i.mjh.nz/.r/sbs-sb03.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sysdata_s_p_a_fifa_6",
    name: "FIFA+",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/82e2f8e9-238d-599f-84e7-891a54026c9f",
    url: "https://i.mjh.nz/.r/sbs-sysdata_s_p_a_fifa_6.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sb01",
    name: "The Cook Up",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/82c5d9dc-bda6-5a6b-affa-67f1ba01ff38",
    url: "https://i.mjh.nz/.r/sbs-sb01.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-7faa",
    name: "Planet Luke Nguyen",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/6c1ccae0-2ddb-5e67-ae24-a4e42f23b2a0",
    url: "https://i.mjh.nz/.r/sbs-7faa.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sbs-chill",
    name: "SBS Chill",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/e7673a4d-8596-5b98-8ed8-04ff7038b458",
    channelNumber: 306,
    url: "https://i.mjh.nz/.r/sbs-sbs-chill.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sbs-pop-asia",
    name: "SBS PopAsia",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/bc85a376-7433-5d0b-9ba8-2b97a744d61b",
    channelNumber: 307,
    url: "https://i.mjh.nz/.r/sbs-sbs-pop-asia.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sbs-pop-desi",
    name: "SBS South Asian",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/4d5e3445-4705-5d55-81cf-3fc64a3ec2ff",
    channelNumber: 305,
    url: "https://i.mjh.nz/.r/sbs-sbs-pop-desi.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sbs-pop-araby",
    name: "SBS Arabic",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/37ad5c21-7dc4-55a9-bfab-0e6d1d8ebcb3",
    channelNumber: 304,
    url: "https://i.mjh.nz/.r/sbs-sbs-pop-araby.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sbs-radio-1",
    name: "SBS Radio 1",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/084f19c8-f6dc-5124-a06a-ebcaf8ef38c6",
    channelNumber: 301,
    url: "https://i.mjh.nz/.r/sbs-sbs-radio-1.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sbs-radio-2",
    name: "SBS Radio 2",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/7d5749f1-254e-57ca-923d-2b2b1b33821f",
    channelNumber: 302,
    url: "https://i.mjh.nz/.r/sbs-sbs-radio-2.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sbs-radio-3",
    name: "SBS Radio 3",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/30724f75-f20c-512c-9108-cda06930de39",
    channelNumber: 303,
    url: "https://i.mjh.nz/.r/sbs-sbs-radio-3.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sbs-sbs-radio-4",
    name: "SBS Radio 4",
    groupTitle: "Au",
    logo: "https://image.pr.sbsod.com/a976dde8-b9e1-5fa1-ac7c-d8431839b02f",
    channelNumber: 304,
    url: "https://i.mjh.nz/.r/sbs-sbs-radio-4.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-kids",
    name: "ABC Kids",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/abc-kids.png",
    channelNumber: 22,
    url: "https://c.mjh.nz/abc-kids.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-tv-plus",
    name: "ABC Family",
    groupTitle: "Au",
    logo: "https://cdn.iview.abc.net.au/thumbs/256/7_Family_C-1053_iview_LivestreamOff_2000x2000_new.png",
    channelNumber: 22,
    url: "https://c.mjh.nz/abc-tv-plus.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-me",
    name: "ABC Entertains",
    groupTitle: "Au",
    logo: "https://cdn.iview.abc.net.au/thumbs/256/6_Entertains_C-1054_iview_LivestreamOn_2000x2000_new.png",
    channelNumber: 23,
    url: "https://c.mjh.nz/abc-me.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-news",
    name: "ABC NEWS",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/abc-news.png",
    channelNumber: 24,
    url: "https://c.mjh.nz/abc-news.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-90-seconds-news",
    name: "ABC News in 90 Seconds",
    groupTitle: "Au",
    logo: "https://live-production.wcms.abc-cdn.net.au/144a0dacebeb9f616c1fcd637e3b2cf2?impolicy=wcms_crop_resize&cropH=630&cropW=1119&xPos=10&yPos=0&width=862&height=485",
    url: "https://c.mjh.nz/news_in_90_seconds",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-90-seconds-business",
    name: "ABC Business in 90 Seconds",
    groupTitle: "Au",
    logo: "https://live-production.wcms.abc-cdn.net.au/ae76d32898cca0be596b7f23c1bd41f2?impolicy=wcms_crop_resize&cropH=630&cropW=1119&xPos=10&yPos=0&width=862&height=485",
    url: "https://c.mjh.nz/business_in_90_seconds",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-90-seconds-sport",
    name: "ABC Sport in 90 Seconds",
    groupTitle: "Au",
    logo: "https://live-production.wcms.abc-cdn.net.au/646cb8a032c847ec21c3de0de881e4cb?impolicy=wcms_crop_resize&cropH=630&cropW=1119&xPos=10&yPos=0&width=862&height=485",
    url: "https://c.mjh.nz/sport_in_90_seconds",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-abc-90-seconds-weather",
    name: "ABC Weather in 90 Seconds",
    groupTitle: "Au",
    logo: "https://live-production.wcms.abc-cdn.net.au/d376e49724862f104d044ff6467f85d8?impolicy=wcms_crop_resize&cropH=630&cropW=1119&xPos=10&yPos=0&width=862&height=485",
    url: "https://c.mjh.nz/weather_in_90_seconds",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-racing-1",
    name: "Sky Racing #1",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/sky-racing-1.png",
    url: "https://i.mjh.nz/.r/sky-racing-1.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-racing-2",
    name: "Sky Racing #2",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/sky-racing-2.png",
    url: "https://i.mjh.nz/.r/sky-racing-2.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-racing-thoroughbred",
    name: "Sky Racing - Thoroughbred Central",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/sky-racing-thoroughbred.png",
    url: "https://i.mjh.nz/.r/sky-racing-thoroughbred.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bloomberg-tv",
    name: "Bloomberg TV",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/bloomberg-tv.png",
    url: "https://i.mjh.nz/.r/bloomberg-tv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-sky-news-now",
    name: "Sky News Now",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/sky-news-now.png",
    url: "https://i.mjh.nz/.r/sky-news-now.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-good-dot",
    name: "GOOD.",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/good-dot.png",
    url: "https://c.mjh.nz/good-dot.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-bbc-news",
    name: "BBC News",
    groupTitle: "Au",
    logo: "https://i.mjh.nz/.images/bbc-news.png",
    url: "https://i.mjh.nz/.r/bbc-news.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-redbull-tv",
    name: "Redbull TV",
    groupTitle: "World",
    logo: "https://i.mjh.nz/.images/redbull-tv.png",
    url: "https://i.mjh.nz/.r/redbull-tv.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-channel-news-asia",
    name: "Channel News Asia (CNA)",
    groupTitle: "World",
    logo: "https://i.mjh.nz/.images/channel-news-asia.png",
    url: "https://i.mjh.nz/.r/channel-news-asia.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  },
  {
    channelId: "mjh-dw-news",
    name: "DW English",
    groupTitle: "World",
    logo: "https://www.dw.com/images/icons/favicon-540x540.png",
    url: "https://i.mjh.nz/.r/dw-news.m3u8",
    userAgent: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    referrer: ""
  }
];

// Added helper functions to fix missing exports build error
export function fetchLiveCategories(): string[] {
  const categories = new Set<string>();
  liveFeedServices.forEach((service) => {
    if (service.groupTitle) {
      categories.add(service.groupTitle);
    }
  });
  return Array.from(categories);
}

export function fetchChannelsByCategory(category: string): LiveFeedService[] {
  return liveFeedServices.filter((service) => service.groupTitle.toLowerCase() === category.toLowerCase());
}
