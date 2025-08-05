// Categorized OSM tags for filtering elements
export const tagGroups = {
  Entertainment: [
    'amenity:casino',
    'amenity:planetarium',
    'leisure:stadium',
    'leisure:water_park',
    'tourism:aquarium',
    'tourism:theme_park',
    'tourism:zoo',
    'building:stadium',
    'aeroway:spaceport',
  ],
  Transport: [
    'boundary:limited_traffic_zone',
    'boundary:low_emission_zone',
    'amenity:boat_rental',
    'barrier:border_control',
    'building:train_station',
    'highway:hitchhiking',
    'man_made:pier',
    'railway:funicular',
    'office:harbour_master',
  ],
  Sport: [
    'leisure:ice_rink',
    'leisure:miniature_golf',
    'amenity:public_bath',
    'amenity:surf_school',
    'amenity:dive_centre',
    'landuse:winter_sports',
    'leisure:marina',
    
  ],
  Culture: [
    'amenity:arts_centre',
    'amenity:monastery',
    'amenity:place_of_worship',
    'building:cathedral',
    'building:church',
    'building:kingdom_hall',
    'building:monastery',
    'building:mosque',
    'building:synagogue',
    'building:temple',
    'building:museum',
    'tourism:artwork',
    'tourism:gallery',
    'tourism:museum',
  ],
  Nature: [
    'landuse:salt_pond',
    'mountain_pass:yes',
    'boundary:aboriginal_lands',
    'boundary:national_park',
    'boundary:protected_area',
    'geological:volcanic_caldera_rim',
    'geological:volcanic_lava_field',
    'geological:volcanic_vent',
    'geological:columnar_jointing',
    'geological:hoodoo',
    'geological:dyke',
    'geological:tor',
    'geological:inselberg',
    'leisure:bird_hide',
    //'leisure:garden',
    'leisure:nature_reserve',
    'natural:beach',
    'natural:blowhole',
    'natural:geyser',
    'natural:glacier',
    'natural:hot_spring',
    'natural:isthmus',
    'natural:arch',
    'natural:cave_entrance',
    //'natural:cliff',
    'natural:dune',
    'natural:fumarole',
    'natural:volcano',
    'tourism:viewpoint',
    'waterway:waterfall',
  ],
  Food: [
    'amenity:marketplace',
    'amenity:food_court',
    'shop:ice_cream',
    'landuse:vineyard',
    'craft:winery',
    'shop:mall',
  ],
  History: [
    'historic:aircraft',
    'historic:aqueduct',
    'historic:archaeological_site',
    'historic:building',
    'historic:castle',
    'historic:castle_wall',
    'historic:church',
    'historic:city_gate',
    'historic:citywalls',
    'historic:district',
    'historic:farm',
    'historic:fort',
    'historic:house',
    'historic:locomotive',
    'historic:manor',
    'historic:monastery',
    'historic:mine',
    'historic:monument',
    'historic:mosque',
    'historic:road',
    'historic:ruins',
    'historic:ship',
    'historic:temple',
    'historic:tomb',
    'historic:tower',
    'historic:wreck',
    'building:bridge',
    'building:beach_hut',
    'building:castle',
    'building:ship',
    'building:triumphal_arch',
    'barrier:city_wall',
    'man_made:lighthouse',
    'man_made:observatory',
    'man_made:watermill',
    'man_made:windmill',
  ],
  Tourism: [
    'leisure:beach_resort',
    'amenity:ranger_station',
    'office:guide',
    'tourism:alpine_hut',
    'tourism:attraction',
    'tourism:yes',
  ],
  Health: [
    'amenity:kneipp_water_cure',
  ],
  Other: [
    'boundary:hazard',
    'boundary:timezone',
  ],
};

// Flattened set of all allowed tags for backward compatibility
// Only include specific categories: Entertainment, Culture, Nature, History, Tourism
const allowedCategories = ['Entertainment', 'Culture', 'Nature', 'History', 'Tourism'];
export const allowedTags = new Set([
  ...allowedCategories.flatMap(category => tagGroups[category as keyof typeof tagGroups] || [])
]);

// Function to get the group for a given tag
export const getTagGroup = (tag: string): string | null => {
  for (const [groupName, tags] of Object.entries(tagGroups)) {
    if (tags.includes(tag)) {
      return groupName;
    }
  }
  return null;
};

// Function to get display name for a tag
export const getTagDisplayName = (tag: string): string => {
  const [key, value] = tag.split(':');
  if (value) {
    return `${key}: ${value.replace(/_/g, ' ')}`;
  }
  return key.replace(/_/g, ' ');
};
