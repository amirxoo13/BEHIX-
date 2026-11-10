/** نمونهٔ ثابت برای آزمون‌های برنامهٔ فیلم (۶ صحنه، ~۲۲۰ ثانیه). */
export const FIXTURE_STORY = "صحنه: خانه، صبح\nسارا و علی در صحنه هستند.\nسارا: صبح بخیر علی، امروز روز بزرگی است.\nعلی: می‌دانم، از دیشب خوابم نبرده.\nسارا: نگران نباش، همه چیز را با هم تمرین کردیم.\nعلی: اگر وسط مسابقه یادم برود چه؟\nسارا: آن وقت به من نگاه کن و نفس عمیق بکش.\nصحنه: خیابان، صبح\nسارا و علی در صحنه هستند.\nعلی: اتوبوس رفت! حالا چه کار کنیم؟\nسارا: پیاده می‌رویم، تا ورزشگاه راهی نیست.\nرضا: سلام بچه‌ها، کجا با این عجله؟\nعلی: مسابقهٔ بزرگ امروز است، دیر کردیم.\nرضا: بپرید بالا، خودم می‌رسانمتان.\nصحنه: ماشین، ظهر\nسارا و علی در صحنه هستند.\nرضا: کمربندها را ببندید، راه شلوغ است.\nسارا: رضا جان، کمی تندتر برو لطفاً.\nرضا: با این ترافیک معجزه لازم داریم.\nعلی: شاید بهتر است برگردیم خانه.\nسارا: حرفش را هم نزن، تا اینجا آمده‌ایم.\nصحنه: ورزشگاه، عصر\nسارا و علی در صحنه هستند.\nمربی: علی، نوبت توست، آماده‌ای؟\nعلی: فکر کنم آماده‌ام، قلبم تند می‌زند.\nمربی: فقط توپ را ببین، بقیه را فراموش کن.\nسارا: علی! ما اینجاییم، تو می‌توانی!\nعلی: این شوت برای همهٔ شما.\nصحنه: ورزشگاه، غروب\nهمه با هم هستند.\nمربی: گل! باورم نمی‌شود، عالی بود!\nرضا: دیدی گفتم معجزه می‌شود؟\nسارا: از اول می‌دانستم از پسش برمی‌آیی.\nعلی: بدون شما هیچ وقت نمی‌توانستم.\nصحنه: کافه، شب\nهمه با هم هستند.\nرضا: شیرینی امشب مهمان من است.\nسارا: پس یک چای هم برای من سفارش بده.\nعلی: فردا دوباره تمرین را شروع می‌کنیم.\nمربی: این شد حرف حساب، قهرمان.";

export const FIXTURE_PLAN = {
 "meta": {
  "title": "روز مسابقه",
  "language": "fa",
  "targetDurationSec": 240,
  "style": "ink",
  "format": "landscape",
  "fps": 30
 },
 "characters": [
  {
   "id": "ali",
   "name": "علی",
   "kind": "man",
   "voice": {
    "voiceId": "Puck"
   }
  },
  {
   "id": "sara",
   "name": "سارا",
   "kind": "woman",
   "voice": {
    "voiceId": "Kore"
   }
  },
  {
   "id": "reza",
   "name": "رضا",
   "kind": "man",
   "voice": {
    "voiceId": "Charon"
   }
  },
  {
   "id": "coach",
   "name": "مربی",
   "kind": "oldMan",
   "voice": {
    "voiceId": "Fenrir"
   }
  }
 ],
 "locations": [
  {
   "id": "loc1",
   "place": "living",
   "label": "خانه، صبح"
  },
  {
   "id": "loc2",
   "place": "street",
   "label": "خیابان، صبح"
  },
  {
   "id": "loc3",
   "place": "car",
   "label": "ماشین، ظهر"
  },
  {
   "id": "loc4",
   "place": "stadium",
   "label": "ورزشگاه، عصر"
  },
  {
   "id": "loc5",
   "place": "stadium",
   "label": "ورزشگاه، غروب"
  },
  {
   "id": "loc6",
   "place": "cafe",
   "label": "کافه، شب"
  }
 ],
 "acts": [
  {
   "id": "act1",
   "title": "شروع",
   "purpose": "setup",
   "scenes": [
    {
     "id": "sc1",
     "locationId": "loc1",
     "timeOfDay": "morning",
     "mood": "calm",
     "summary": "خانه، صبح",
     "sourceLines": [
      1,
      2,
      3,
      4,
      5,
      6,
      7
     ],
     "shots": [
      {
       "id": "s1-est",
       "shotType": "establishing",
       "cameraMove": "pushIn",
       "durationSec": 5,
       "characters": [],
       "acting": [],
       "dialogue": [],
       "transitionOut": "cut",
       "caption": "خانه، صبح"
      },
      {
       "id": "s1-l1",
       "shotType": "medium",
       "cameraMove": "static",
       "durationSec": 7.5,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "sara",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "explain",
         "expression": "smile"
        }
       ],
       "dialogue": [
        {
         "speakerId": "sara",
         "text": "صبح بخیر علی، امروز روز بزرگی است.",
         "startSec": 0.4,
         "endSec": 5.5,
         "emotion": "smile"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        3
       ]
      },
      {
       "id": "s1-l2",
       "shotType": "close",
       "cameraMove": "static",
       "durationSec": 6.4,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "ali",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "point",
         "expression": "worried"
        }
       ],
       "dialogue": [
        {
         "speakerId": "ali",
         "text": "می‌دانم، از دیشب خوابم نبرده.",
         "startSec": 0.4,
         "endSec": 4.4,
         "emotion": "worried"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        4
       ]
      },
      {
       "id": "s1-l3",
       "shotType": "overShoulder",
       "cameraMove": "static",
       "durationSec": 8.6,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "sara",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "handChest",
         "expression": "surprised"
        }
       ],
       "dialogue": [
        {
         "speakerId": "sara",
         "text": "نگران نباش، همه چیز را با هم تمرین کردیم.",
         "startSec": 0.4,
         "endSec": 6.6000000000000005,
         "emotion": "surprised"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        5
       ]
      },
      {
       "id": "s1-l4",
       "shotType": "twoShot",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "ali",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "shrug",
         "expression": "content"
        }
       ],
       "dialogue": [
        {
         "speakerId": "ali",
         "text": "اگر وسط مسابقه یادم برود چه؟",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "content"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        6
       ]
      },
      {
       "id": "s1-l5",
       "shotType": "reaction",
       "cameraMove": "static",
       "durationSec": 9.1,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "sara",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "wave",
         "expression": "laugh"
        }
       ],
       "dialogue": [
        {
         "speakerId": "sara",
         "text": "آن وقت به من نگاه کن و نفس عمیق بکش.",
         "startSec": 0.4,
         "endSec": 7.1000000000000005,
         "emotion": "laugh"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        7
       ]
      }
     ]
    },
    {
     "id": "sc2",
     "locationId": "loc2",
     "timeOfDay": "morning",
     "mood": "comic",
     "summary": "خیابان، صبح",
     "sourceLines": [
      8,
      9,
      10,
      11,
      12,
      13,
      14
     ],
     "shots": [
      {
       "id": "s2-est",
       "shotType": "establishing",
       "cameraMove": "pushIn",
       "durationSec": 5,
       "characters": [],
       "acting": [],
       "dialogue": [],
       "transitionOut": "fade",
       "caption": "خیابان، صبح"
      },
      {
       "id": "s2-l1",
       "shotType": "medium",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "ali",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "explain",
         "expression": "smile"
        }
       ],
       "dialogue": [
        {
         "speakerId": "ali",
         "text": "اتوبوس رفت! حالا چه کار کنیم؟",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "smile"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        10
       ]
      },
      {
       "id": "s2-l2",
       "shotType": "close",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "sara",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "point",
         "expression": "worried"
        }
       ],
       "dialogue": [
        {
         "speakerId": "sara",
         "text": "پیاده می‌رویم، تا ورزشگاه راهی نیست.",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "worried"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        11
       ]
      },
      {
       "id": "s2-l3",
       "shotType": "overShoulder",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "reza",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "handChest",
         "expression": "surprised"
        }
       ],
       "dialogue": [
        {
         "speakerId": "reza",
         "text": "سلام بچه‌ها، کجا با این عجله؟",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "surprised"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        12
       ]
      },
      {
       "id": "s2-l4",
       "shotType": "twoShot",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "ali",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "shrug",
         "expression": "content"
        }
       ],
       "dialogue": [
        {
         "speakerId": "ali",
         "text": "مسابقهٔ بزرگ امروز است، دیر کردیم.",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "content"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        13
       ]
      },
      {
       "id": "s2-l5",
       "shotType": "reaction",
       "cameraMove": "static",
       "durationSec": 5.8,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "reza",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "wave",
         "expression": "laugh"
        }
       ],
       "dialogue": [
        {
         "speakerId": "reza",
         "text": "بپرید بالا، خودم می‌رسانمتان.",
         "startSec": 0.4,
         "endSec": 3.8,
         "emotion": "laugh"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        14
       ]
      }
     ]
    }
   ]
  },
  {
   "id": "act2",
   "title": "گره",
   "purpose": "confrontation",
   "scenes": [
    {
     "id": "sc3",
     "locationId": "loc3",
     "timeOfDay": "noon",
     "mood": "comic",
     "summary": "ماشین، ظهر",
     "sourceLines": [
      15,
      16,
      17,
      18,
      19,
      20,
      21
     ],
     "shots": [
      {
       "id": "s3-est",
       "shotType": "establishing",
       "cameraMove": "pushIn",
       "durationSec": 5,
       "characters": [],
       "acting": [],
       "dialogue": [],
       "transitionOut": "fade",
       "caption": "ماشین، ظهر"
      },
      {
       "id": "s3-l1",
       "shotType": "medium",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "reza",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "explain",
         "expression": "smile"
        }
       ],
       "dialogue": [
        {
         "speakerId": "reza",
         "text": "کمربندها را ببندید، راه شلوغ است.",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "smile"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        17
       ]
      },
      {
       "id": "s3-l2",
       "shotType": "close",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "sara",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "point",
         "expression": "worried"
        }
       ],
       "dialogue": [
        {
         "speakerId": "sara",
         "text": "رضا جان، کمی تندتر برو لطفاً.",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "worried"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        18
       ]
      },
      {
       "id": "s3-l3",
       "shotType": "overShoulder",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "reza",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "handChest",
         "expression": "surprised"
        }
       ],
       "dialogue": [
        {
         "speakerId": "reza",
         "text": "با این ترافیک معجزه لازم داریم.",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "surprised"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        19
       ]
      },
      {
       "id": "s3-l4",
       "shotType": "twoShot",
       "cameraMove": "static",
       "durationSec": 6.4,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "ali",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "shrug",
         "expression": "content"
        }
       ],
       "dialogue": [
        {
         "speakerId": "ali",
         "text": "شاید بهتر است برگردیم خانه.",
         "startSec": 0.4,
         "endSec": 4.4,
         "emotion": "content"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        20
       ]
      },
      {
       "id": "s3-l5",
       "shotType": "reaction",
       "cameraMove": "static",
       "durationSec": 7.5,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "reza",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "sara",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "wave",
         "expression": "laugh"
        }
       ],
       "dialogue": [
        {
         "speakerId": "sara",
         "text": "حرفش را هم نزن، تا اینجا آمده‌ایم.",
         "startSec": 0.4,
         "endSec": 5.5,
         "emotion": "laugh"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        21
       ]
      }
     ]
    }
   ]
  },
  {
   "id": "act3",
   "title": "اوج",
   "purpose": "climax",
   "scenes": [
    {
     "id": "sc4",
     "locationId": "loc4",
     "timeOfDay": "afternoon",
     "mood": "tense",
     "summary": "ورزشگاه، عصر",
     "sourceLines": [
      22,
      23,
      24,
      25,
      26,
      27,
      28
     ],
     "shots": [
      {
       "id": "s4-est",
       "shotType": "establishing",
       "cameraMove": "pushIn",
       "durationSec": 5,
       "characters": [],
       "acting": [],
       "dialogue": [],
       "transitionOut": "fade",
       "caption": "ورزشگاه، عصر"
      },
      {
       "id": "s4-l1",
       "shotType": "medium",
       "cameraMove": "static",
       "durationSec": 5.8,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "coach",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "explain",
         "expression": "smile"
        }
       ],
       "dialogue": [
        {
         "speakerId": "coach",
         "text": "علی، نوبت توست، آماده‌ای؟",
         "startSec": 0.4,
         "endSec": 3.8,
         "emotion": "smile"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        24
       ]
      },
      {
       "id": "s4-l2",
       "shotType": "close",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "ali",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "point",
         "expression": "worried"
        }
       ],
       "dialogue": [
        {
         "speakerId": "ali",
         "text": "فکر کنم آماده‌ام، قلبم تند می‌زند.",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "worried"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        25
       ]
      },
      {
       "id": "s4-l3",
       "shotType": "overShoulder",
       "cameraMove": "static",
       "durationSec": 8.0,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "coach",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "handChest",
         "expression": "surprised"
        }
       ],
       "dialogue": [
        {
         "speakerId": "coach",
         "text": "فقط توپ را ببین، بقیه را فراموش کن.",
         "startSec": 0.4,
         "endSec": 6.0,
         "emotion": "surprised"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        26
       ]
      },
      {
       "id": "s4-l4",
       "shotType": "twoShot",
       "cameraMove": "static",
       "durationSec": 6.4,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "sara",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "shrug",
         "expression": "content"
        }
       ],
       "dialogue": [
        {
         "speakerId": "sara",
         "text": "علی! ما اینجاییم، تو می‌توانی!",
         "startSec": 0.4,
         "endSec": 4.4,
         "emotion": "content"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        27
       ]
      },
      {
       "id": "s4-l5",
       "shotType": "reaction",
       "cameraMove": "static",
       "durationSec": 6.4,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.5
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "ali",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "wave",
         "expression": "laugh"
        }
       ],
       "dialogue": [
        {
         "speakerId": "ali",
         "text": "این شوت برای همهٔ شما.",
         "startSec": 0.4,
         "endSec": 4.4,
         "emotion": "laugh"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        28
       ]
      }
     ]
    }
   ]
  },
  {
   "id": "act4",
   "title": "گره‌گشایی",
   "purpose": "resolution",
   "scenes": [
    {
     "id": "sc5",
     "locationId": "loc5",
     "timeOfDay": "dusk",
     "mood": "joyful",
     "summary": "ورزشگاه، غروب",
     "sourceLines": [
      29,
      30,
      31,
      32,
      33,
      34
     ],
     "shots": [
      {
       "id": "s5-est",
       "shotType": "establishing",
       "cameraMove": "pushIn",
       "durationSec": 5,
       "characters": [],
       "acting": [],
       "dialogue": [],
       "transitionOut": "fade",
       "caption": "ورزشگاه، غروب"
      },
      {
       "id": "s5-l1",
       "shotType": "medium",
       "cameraMove": "static",
       "durationSec": 6.4,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.42
        },
        {
         "characterId": "reza",
         "startX": 0.58
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "coach",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "explain",
         "expression": "smile"
        }
       ],
       "dialogue": [
        {
         "speakerId": "coach",
         "text": "گل! باورم نمی‌شود، عالی بود!",
         "startSec": 0.4,
         "endSec": 4.4,
         "emotion": "smile"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        31
       ]
      },
      {
       "id": "s5-l2",
       "shotType": "close",
       "cameraMove": "static",
       "durationSec": 5.8,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.42
        },
        {
         "characterId": "reza",
         "startX": 0.58
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "reza",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "point",
         "expression": "worried"
        }
       ],
       "dialogue": [
        {
         "speakerId": "reza",
         "text": "دیدی گفتم معجزه می‌شود؟",
         "startSec": 0.4,
         "endSec": 3.8,
         "emotion": "worried"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        32
       ]
      },
      {
       "id": "s5-l3",
       "shotType": "overShoulder",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.42
        },
        {
         "characterId": "reza",
         "startX": 0.58
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "sara",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "handChest",
         "expression": "surprised"
        }
       ],
       "dialogue": [
        {
         "speakerId": "sara",
         "text": "از اول می‌دانستم از پسش برمی‌آیی.",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "surprised"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        33
       ]
      },
      {
       "id": "s5-l4",
       "shotType": "twoShot",
       "cameraMove": "static",
       "durationSec": 6.4,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.42
        },
        {
         "characterId": "reza",
         "startX": 0.58
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "ali",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "shrug",
         "expression": "content"
        }
       ],
       "dialogue": [
        {
         "speakerId": "ali",
         "text": "بدون شما هیچ وقت نمی‌توانستم.",
         "startSec": 0.4,
         "endSec": 4.4,
         "emotion": "content"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        34
       ]
      }
     ]
    }
   ]
  },
  {
   "id": "act5",
   "title": "پایان",
   "purpose": "epilogue",
   "scenes": [
    {
     "id": "sc6",
     "locationId": "loc6",
     "timeOfDay": "night",
     "mood": "calm",
     "summary": "کافه، شب",
     "sourceLines": [
      35,
      36,
      37,
      38,
      39,
      40
     ],
     "shots": [
      {
       "id": "s6-est",
       "shotType": "establishing",
       "cameraMove": "pushIn",
       "durationSec": 5,
       "characters": [],
       "acting": [],
       "dialogue": [],
       "transitionOut": "fade",
       "caption": "کافه، شب"
      },
      {
       "id": "s6-l1",
       "shotType": "medium",
       "cameraMove": "static",
       "durationSec": 6.4,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.42
        },
        {
         "characterId": "reza",
         "startX": 0.58
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "reza",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "explain",
         "expression": "smile"
        }
       ],
       "dialogue": [
        {
         "speakerId": "reza",
         "text": "شیرینی امشب مهمان من است.",
         "startSec": 0.4,
         "endSec": 4.4,
         "emotion": "smile"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        37
       ]
      },
      {
       "id": "s6-l2",
       "shotType": "close",
       "cameraMove": "static",
       "durationSec": 8.0,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.42
        },
        {
         "characterId": "reza",
         "startX": 0.58
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "sara",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "point",
         "expression": "worried"
        }
       ],
       "dialogue": [
        {
         "speakerId": "sara",
         "text": "پس یک چای هم برای من سفارش بده.",
         "startSec": 0.4,
         "endSec": 6.0,
         "emotion": "worried"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        38
       ]
      },
      {
       "id": "s6-l3",
       "shotType": "overShoulder",
       "cameraMove": "static",
       "durationSec": 6.9,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.42
        },
        {
         "characterId": "reza",
         "startX": 0.58
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "ali",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "handChest",
         "expression": "surprised"
        }
       ],
       "dialogue": [
        {
         "speakerId": "ali",
         "text": "فردا دوباره تمرین را شروع می‌کنیم.",
         "startSec": 0.4,
         "endSec": 4.9,
         "emotion": "surprised"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        39
       ]
      },
      {
       "id": "s6-l4",
       "shotType": "twoShot",
       "cameraMove": "static",
       "durationSec": 6.4,
       "characters": [
        {
         "characterId": "ali",
         "startX": 0.25
        },
        {
         "characterId": "coach",
         "startX": 0.42
        },
        {
         "characterId": "reza",
         "startX": 0.58
        },
        {
         "characterId": "sara",
         "startX": 0.75
        }
       ],
       "acting": [
        {
         "characterId": "coach",
         "atSec": 0.2,
         "durationSec": 1.2,
         "gesture": "shrug",
         "expression": "content"
        }
       ],
       "dialogue": [
        {
         "speakerId": "coach",
         "text": "این شد حرف حساب، قهرمان.",
         "startSec": 0.4,
         "endSec": 4.4,
         "emotion": "content"
        }
       ],
       "transitionOut": "cut",
       "sourceLines": [
        40
       ]
      }
     ]
    }
   ]
  }
 ]
} as const;
