export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface MandalBoundaryFeature {
  type: 'Feature';
  properties: {
    mandalId: string;
    mandalName: string;
    district: string;
    headquarters: string;
    catchmentHospitalId: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][]; // [ [ [lng, lat], ... ] ]
  };
}

export interface TransportCorridor {
  corridorId: string;
  name: string;
  originMandal: string;
  destination: string;
  roadType: 'state_highway' | 'major_district_road' | 'tribal_feeder';
  roadCondition: 'good_paved' | 'winding_ghat' | 'rough_gravel' | 'monsoon_vulnerable';
  distanceKm: number;
  estimatedTravelTimeMins: number;
  transitModes: string[];
  routePath: {
    type: 'LineString';
    coordinates: number[][]; // [ [lng, lat], ... ]
  };
}

export interface ConnectivityZone {
  zoneId: string;
  mandal: string;
  zoneType: 'high_connectivity_hub' | 'intermittent_2g' | 'shadow_zone';
  coverageStatus: 'connected' | 'unstable' | 'offline_shadow';
  carrierCoverage: string[];
  offlineModeRecommended: boolean;
  gpsCentroid: GeoPoint;
}

export const ITDA_PADERU_MANDALS: MandalBoundaryFeature[] = [
  {
    type: 'Feature',
    properties: {
      mandalId: 'mandal_paderu',
      mandalName: 'Paderu',
      district: 'Alluri Sitharama Raju',
      headquarters: 'Paderu Town',
      catchmentHospitalId: 'hosp_paderu_dh',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [82.64, 18.06],
          [82.68, 18.06],
          [82.70, 18.10],
          [82.65, 18.12],
          [82.64, 18.06],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    properties: {
      mandalId: 'mandal_araku_valley',
      mandalName: 'Araku Valley',
      district: 'Alluri Sitharama Raju',
      headquarters: 'Araku',
      catchmentHospitalId: 'hosp_araku_chc',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [82.84, 18.30],
          [82.90, 18.30],
          [82.92, 18.35],
          [82.85, 18.37],
          [82.84, 18.30],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    properties: {
      mandalId: 'mandal_hukumpeta',
      mandalName: 'Hukumpeta',
      district: 'Alluri Sitharama Raju',
      headquarters: 'Hukumpeta',
      catchmentHospitalId: 'hosp_paderu_dh',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [82.69, 18.13],
          [82.75, 18.13],
          [82.76, 18.18],
          [82.70, 18.18],
          [82.69, 18.13],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    properties: {
      mandalId: 'mandal_chintapalli',
      mandalName: 'Chintapalli',
      district: 'Alluri Sitharama Raju',
      headquarters: 'Chintapalli',
      catchmentHospitalId: 'hosp_chintapalli_chc',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [82.32, 17.85],
          [82.40, 17.85],
          [82.42, 17.92],
          [82.33, 17.92],
          [82.32, 17.85],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    properties: {
      mandalId: 'mandal_ananthagiri',
      mandalName: 'Ananthagiri',
      district: 'Alluri Sitharama Raju',
      headquarters: 'Ananthagiri',
      catchmentHospitalId: 'hosp_araku_chc',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [82.98, 18.22],
          [83.05, 18.22],
          [83.06, 18.28],
          [82.99, 18.28],
          [82.98, 18.22],
        ],
      ],
    },
  },
];

export const PADERU_TRANSPORT_CORRIDORS: TransportCorridor[] = [
  {
    corridorId: 'corridor_araku_paderu_sh39',
    name: 'Araku-Paderu Ghat Corridor (SH-39)',
    originMandal: 'Araku Valley',
    destination: 'District Hospital Paderu',
    roadType: 'state_highway',
    roadCondition: 'winding_ghat',
    distanceKm: 46.5,
    estimatedTravelTimeMins: 75,
    transitModes: ['108_ambulance', 'rtc_bus', 'tribal_jeep'],
    routePath: {
      type: 'LineString',
      coordinates: [
        [82.87, 18.33],
        [82.78, 18.22],
        [82.66, 18.08],
      ],
    },
  },
  {
    corridorId: 'corridor_chintapalli_paderu_sh38',
    name: 'Chintapalli-Paderu Forest Corridor (SH-38)',
    originMandal: 'Chintapalli',
    destination: 'District Hospital Paderu',
    roadType: 'state_highway',
    roadCondition: 'rough_gravel',
    distanceKm: 52.0,
    estimatedTravelTimeMins: 90,
    transitModes: ['108_ambulance', 'rtc_bus', 'motorcycle'],
    routePath: {
      type: 'LineString',
      coordinates: [
        [82.35, 17.88],
        [82.50, 17.98],
        [82.66, 18.08],
      ],
    },
  },
  {
    corridorId: 'corridor_hukumpeta_paderu_mdr',
    name: 'Hukumpeta-Paderu Feeder Road',
    originMandal: 'Hukumpeta',
    destination: 'District Hospital Paderu',
    roadType: 'tribal_feeder',
    roadCondition: 'monsoon_vulnerable',
    distanceKm: 21.0,
    estimatedTravelTimeMins: 45,
    transitModes: ['108_ambulance', 'feeder_auto', 'tribal_jeep'],
    routePath: {
      type: 'LineString',
      coordinates: [
        [82.72, 18.15],
        [82.68, 18.10],
        [82.66, 18.08],
      ],
    },
  },
];

export const PADERU_CONNECTIVITY_ZONES: ConnectivityZone[] = [
  {
    zoneId: 'zone_paderu_central',
    mandal: 'Paderu',
    zoneType: 'high_connectivity_hub',
    coverageStatus: 'connected',
    carrierCoverage: ['BSNL', 'Airtel', 'Jio'],
    offlineModeRecommended: false,
    gpsCentroid: { latitude: 18.083, longitude: 82.665 },
  },
  {
    zoneId: 'zone_matsyapuram_shadow',
    mandal: 'Paderu',
    zoneType: 'shadow_zone',
    coverageStatus: 'offline_shadow',
    carrierCoverage: [],
    offlineModeRecommended: true,
    gpsCentroid: { latitude: 18.042, longitude: 82.618 },
  },
  {
    zoneId: 'zone_araku_valley_semi_urban',
    mandal: 'Araku Valley',
    zoneType: 'high_connectivity_hub',
    coverageStatus: 'connected',
    carrierCoverage: ['BSNL', 'Airtel', 'Jio'],
    offlineModeRecommended: false,
    gpsCentroid: { latitude: 18.333, longitude: 82.873 },
  },
  {
    zoneId: 'zone_hukumpeta_hills_2g',
    mandal: 'Hukumpeta',
    zoneType: 'intermittent_2g',
    coverageStatus: 'unstable',
    carrierCoverage: ['BSNL (Voice Only)'],
    offlineModeRecommended: true,
    gpsCentroid: { latitude: 18.154, longitude: 82.721 },
  },
];
