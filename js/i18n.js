// EN/JP string tables. Keep keys in sync between both languages.
const i18n = {
    EN: {
        title: "Tenchijin SatTracker", subtitle: "Japan Coverage", realtime: "Real-Time",
        geostationary: "Geostationary", live: "Live", inMins: (m) => `In ${m}m`, predicted: "Predicted",
        fullDisk: "Full Disk", cycle10m: "Geostationary • 10 min cycle",
        listRecent: "Recent Passes", listLive: "Live Now", listUpcoming: "Upcoming Passes",
        nowDivider: "Now", roadmap: "Roadmap", futureRoadmap: "Roadmap",
        // Every still-open idea from docs/IDEAS.md and WishList.md, kept in
        // sync with those files -- see docs/CHANGELOG.md 2026-08-28
        // "roadmap popup lists every open idea" before hand-editing this.
        roadmapItems: [
            "Historical satellite position slider (scrub back in time)",
            "Free lat/lng location input, not just the 9 Japan regions",
            "Today's passes summary/digest view",
            "Real per-latitude swath width, not a fixed estimate",
            "Individual scene grid (path/row), like Landsat's acquisition site",
            "Export the acquired footprint as a QGIS-ready polygon for AOI planning"
        ],
        tracking: "TRACKING:",
        dataLive: "Live TLE", dataPartial: "Partial live TLE", dataOffline: "Offline snapshot", dataLoading: "Loading TLE…",
        updated: "Updated",
        regionAll: "All Regions", typeAll: "All Types",
        regions: { 'Hokkaido': 'Hokkaido', 'Tohoku': 'Tohoku', 'Kanto': 'Kanto', 'Chubu': 'Chubu', 'Kansai': 'Kansai', 'Chugoku': 'Chugoku', 'Shikoku': 'Shikoku', 'Kyushu': 'Kyushu', 'Okinawa': 'Okinawa' },
        satTypes: { 'SAR_L': 'SAR (L-band)', 'OPTICAL': 'Optical', 'SAR_C': 'SAR (C-band)', 'MULTISPECTRAL': 'Multispectral', 'THERMAL': 'Thermal Infrared' },
        node: { ascending: 'Ascending node', descending: 'Descending node' },
        allOverpassesLabel: "All overpasses", likelyAcquisitionsLabel: "Likely acquisitions",
        allDataLabel: "All data", freeDataOnlyLabel: "Free data only",
        acquisitionUnlikely: "Acquisition unlikely (ascending-node optical pass)",
        missionEnded: (d) => `Mission ended ${d} — no acquisition`,
        endedSuffix: "ended",
        satFilterActive: (name) => `Showing: ${name}`, clearFilter: "Clear",
        dataExpected: (str) => `Expected data ~${str}`,
        dataAvailabilityUnknown: "Data availability: no public latency figure",
        nextDataIn: "Next data in", noUpcomingData: "No upcoming data in view",
        infoLaunchDate: "Launch date", infoOperator: "Operator", infoSensorSuite: "Sensor suite",
        infoResolution: "Resolution",
        infoSwath: "Swath width", infoCycle: "Revisit cycle", infoNoradId: "NORAD ID",
        infoMissionStatus: "Mission status", infoDataLatency: "Typical data latency",
        infoLatencyUnknown: "No public figure",
        cloudRiskChance: "Forecast: chance of cloud cover during this pass (optical/thermal data may be degraded)",
        cloudRiskLikely: "Forecast: very likely cloud-covered during this pass (optical/thermal data likely degraded)",
        dateFormat: 'en-GB'
    },
    JP: {
        title: "天地人 SatTracker", subtitle: "日本領域カバー", realtime: "リアルタイム",
        geostationary: "静止衛星", live: "ライブ", inMins: (m) => `${m}分後`, predicted: "予測パス",
        fullDisk: "フルディスク", cycle10m: "静止衛星 • 10分周期",
        listRecent: "最近のパス", listLive: "ライブ中", listUpcoming: "今後のパス",
        nowDivider: "現在", roadmap: "ロードマップ", futureRoadmap: "ロードマップ",
        roadmapItems: [
            "過去の衛星位置を動かせるスライダー",
            "日本地域だけでなく、緯度経度を自由入力",
            "本日のパスの概要表示",
            "緯度によって変わる実際の観測幅のモデル化",
            "Landsatの取得サイトのようなパス/ロー単位のシーングリッド表示",
            "QGISで使えるポリゴンとして取得範囲をエクスポート"
        ],
        tracking: "トラッキング:",
        dataLive: "ライブTLE", dataPartial: "一部ライブTLE", dataOffline: "オフラインスナップショット", dataLoading: "TLE読込中…",
        updated: "更新",
        regionAll: "全地域", typeAll: "全タイプ",
        regions: { 'Hokkaido': '北海道', 'Tohoku': '東北', 'Kanto': '関東', 'Chubu': '中部', 'Kansai': '関西', 'Chugoku': '中国', 'Shikoku': '四国', 'Kyushu': '九州', 'Okinawa': '沖縄' },
        satTypes: { 'SAR_L': 'SAR (Lバンド)', 'OPTICAL': '光学', 'SAR_C': 'SAR (Cバンド)', 'MULTISPECTRAL': 'マルチスペクトル', 'THERMAL': '熱赤外' },
        node: { ascending: '上昇軌道', descending: '下降軌道' },
        allOverpassesLabel: "全オーバーパス", likelyAcquisitionsLabel: "取得の可能性が高いもの",
        allDataLabel: "全データ", freeDataOnlyLabel: "無償データのみ",
        acquisitionUnlikely: "取得の可能性は低い（上昇軌道の光学パス）",
        missionEnded: (d) => `ミッション終了 ${d} — 取得なし`,
        endedSuffix: "終了",
        satFilterActive: (name) => `表示中: ${name}`, clearFilter: "クリア",
        dataExpected: (str) => `データ提供予定 ~${str}`,
        dataAvailabilityUnknown: "データ提供時期: 公開情報なし",
        nextDataIn: "次のデータまで", noUpcomingData: "表示範囲内に今後のデータなし",
        infoLaunchDate: "打上げ日", infoOperator: "運用機関", infoSensorSuite: "搭載センサ",
        infoResolution: "分解能",
        infoSwath: "観測幅", infoCycle: "再訪周期", infoNoradId: "NORAD ID",
        infoMissionStatus: "ミッション状況", infoDataLatency: "標準的なデータ提供時間",
        infoLatencyUnknown: "公開情報なし",
        cloudRiskChance: "予報：このパス時に雲に覆われる可能性あり（光学・熱赤外データが劣化する場合あり）",
        cloudRiskLikely: "予報：このパス時に雲に覆われる可能性が非常に高い（光学・熱赤外データが劣化する可能性が高い）",
        dateFormat: 'ja-JP'
    }
};

let currentLang = 'EN';
function t() { return i18n[currentLang]; }
