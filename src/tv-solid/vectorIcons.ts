/*
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
/** Paths from lucide-react 0.468.0 (ISC), the same icon source as the React UI.
 * Copyright (c) Lucide Contributors. See node_modules/lucide-react/LICENSE. */
const shapes = {
  "search": [
    [
      "circle",
      {
        "cx": "11",
        "cy": "11",
        "r": "8"
      }
    ],
    [
      "path",
      {
        "d": "m21 21-4.3-4.3"
      }
    ]
  ],
  "home": [
    [
      "path",
      {
        "d": "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
      }
    ],
    [
      "path",
      {
        "d": "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      }
    ]
  ],
  "discover": [
    [
      "path",
      {
        "d": "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"
      }
    ],
    [
      "circle",
      {
        "cx": "12",
        "cy": "12",
        "r": "10"
      }
    ]
  ],
  "live": [
    [
      "rect",
      {
        "width": "20",
        "height": "15",
        "x": "2",
        "y": "7",
        "rx": "2",
        "ry": "2"
      }
    ],
    [
      "polyline",
      {
        "points": "17 2 12 7 7 2"
      }
    ]
  ],
  "list": [
    [
      "path",
      {
        "d": "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
      }
    ]
  ],
  "settings": [
    [
      "path",
      {
        "d": "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      }
    ],
    [
      "circle",
      {
        "cx": "12",
        "cy": "12",
        "r": "3"
      }
    ]
  ],
  "pencil": [
    [
      "path",
      {
        "d": "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
      }
    ],
    [
      "path",
      {
        "d": "m15 5 4 4"
      }
    ]
  ],
  "trash": [
    [
      "path",
      {
        "d": "M3 6h18"
      }
    ],
    [
      "path",
      {
        "d": "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
      }
    ],
    [
      "path",
      {
        "d": "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
      }
    ],
    [
      "line",
      {
        "x1": "10",
        "x2": "10",
        "y1": "11",
        "y2": "17"
      }
    ],
    [
      "line",
      {
        "x1": "14",
        "x2": "14",
        "y1": "11",
        "y2": "17"
      }
    ]
  ],
  "plus": [
    [
      "path",
      {
        "d": "M5 12h14"
      }
    ],
    [
      "path",
      {
        "d": "M12 5v14"
      }
    ]
  ],
  "check": [
    [
      "path",
      {
        "d": "M20 6 9 17l-5-5"
      }
    ]
  ]
} as const;
export type VectorIcon = keyof typeof shapes | "play";
const cache = new Map<string,string>();
export function vectorIcon(name: VectorIcon, color: string) {
  const key=name+color;
  const known=cache.get(key);if(known)return known;
  const body=name==='play' ? '<path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z"/>' : shapes[name].map(([tag,attributes])=>'<'+tag+' '+Object.entries(attributes).map(([k,v])=>k+'="'+v+'"').join(' ')+'/>').join('');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="'+(name==='play'?color:'none')+'" stroke="'+(name==='play'?'none':color)+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+body+'</svg>';
  const source='data:image/svg+xml,'+encodeURIComponent(svg);cache.set(key,source);return source;
}
