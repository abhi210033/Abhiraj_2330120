var roi = ee.FeatureCollection([ee.Feature(rol)]);
var sentinel2Collection = ee.ImageCollection("COPERNICUS/S2")
  .filterBounds(rol)
  .filterDate('2021-01-03', '2021-10-15')
  .sort('system:time_start');

var sarcollection = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(rol)
  .filterDate('2021-01-01', '2021-12-31')
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.calendarRange(0, 365, 'day_of_year'))
  .sort('system:time_start');


// Define the time interval between images (in days)
var interval = 12;

// Get the date range for filtering
var startDate = ee.Date('2021-01-01');
var endDate = ee.Date('2021-12-31');

// Convert dates to milliseconds since Unix epoch
var startMillis = startDate.millis();
var endMillis = endDate.millis();

// Calculate the number of milliseconds in the interval
var intervalMillis = interval * 24 * 60 * 60 * 1000;

// Create a list of dates within the specified range
var datesList = ee.List.sequence(startMillis, endMillis, intervalMillis);

// Iterate over the dates list to construct the filter
var  sarCollection = ee.ImageCollection.fromImages(datesList.map(function(date) {
  date = ee.Date(date);
  var start = date;
  var end = date.advance(interval, 'day');
  var filterCondition = ee.Filter.date(start, end);
  return sarcollection.filter(filterCondition).first();
}));

// Remove null values from the filtered collection
sarCollection = sarCollection.filter(ee.Filter.notNull([]));

// // Check the size of the original collection and the filtered collection
// print('Original SAR Collection Size:', sarCollection.size());
// print('Filtered SAR Collection Size:', filteredSARCollection.size());


var esaDataset = ee.ImageCollection('ESA/WorldCover/v200')
  .filterBounds(rol)
  .first();

var vegetation = 10;
var croplands = 40;
var shrubland = 20;
var grassland = 30;
var removalMask = esaDataset.eq(grassland);
var sarMaskedVegetation = sarCollection.map(function(image) {
  var maskedVegetation = image.updateMask(removalMask);
  return maskedVegetation;
});


var calculateSoilMoisture = function(image) {
   var soilMoisture = image.select('VV')
    .expression('(image / constant) + constant2', {
      'image': image.select('VV'),
      'constant': 0.3711,
      'constant2': 52.48
    })
    .rename('SM');
  return image.addBands(soilMoisture);
};


// Apply the calculateSoilMoisture function to the SAR collection
var soilMoistureVegetation = sarMaskedVegetation.map(calculateSoilMoisture);




// Calculate and display the histogram of Soil Moisture for vegetation
var vegetationSoilMoistureHistogram = ui.Chart.image.histogram(soilMoistureVegetation.sort('system:time_start').first(), roi, 30)
  .setOptions({title: 'Vegetation Soil Moisture Histogram', hAxis: {title: 'Soil Moisture (%)'}, vAxis: {title: 'Count'}});
print(vegetationSoilMoistureHistogram);


var soilMoistureImage = soilMoistureVegetation.select('SM').first();
var clippedSoilMoisture = soilMoistureImage.clip(roi);

Map.addLayer(
  clippedSoilMoisture,
  {min: 6, max: 58, palette: ['red', 'blue', 'yellow', 'green']},
  'Vegetation Soil Moisture'
);

var feature = roi.first();
var region = feature.geometry();

var pixelCount = ee.Image().int().paint(region, 1).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: region,
  scale: 30
});

var count = ee.Number(pixelCount.get("constant"));
print("Pixel Count:", count);

var image = sentinel2Collection.first();
var band = image.select('B4');
var scale = band.projection().nominalScale();
print("Pixel Size (meters per pixel):", scale);





var geometry = ee.Geometry.Polygon([
  [[82.14034271923366, 26.81208481866374],
  [82.20557404247585, 26.81208481866374],
  [82.20557404247585, 26.845938327349966],
  [82.14034271923366, 26.845938327349966],
  [82.14034271923366, 26.81208481866374]]
]);

var area = geometry.area();
print('Area:', area);

var extractLIA = function(image) {
  var lia = image.select('angle');
  return image.addBands(lia.rename('LIA'));
};

var sarCollectionWithLIA = sarCollection.map(extractLIA);
var firstImageWithLIA = sarCollectionWithLIA.first();
var liaImage = firstImageWithLIA.select('LIA');
var clippedLIA = liaImage.clip(region);


var meanLIA = liaImage.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: region,
  scale: 30
});

var meanLIAValue = meanLIA.getNumber('LIA');
print('Mean Local Incidence Angle:', meanLIAValue);

var firstSARImage = sarCollection.first(); // Get the first image from the sarCollection

// Get the acquisition date of the first image
var acquisitionDate = ee.Date(firstSARImage.get('system:time_start'));

// Print the acquisition date
print('Acquisition Date:', acquisitionDate);








var selectedPixel = ee.Geometry.Point(82.15609234909594,26.83576065161928); 




var singlePixel = soilMoistureVegetation
  .map(function(image) {
    
    var valueSM = image.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: selectedPixel,
      scale: 30,
    }).get('SM');
    return ee.Feature(null, {  'SM': valueSM }).set('system:time_start', image.get('system:time_start'));
  });

// Create a time series chart
var timeSeriesChart = ui.Chart.feature.byFeature(singlePixel, 'system:time_start', ['SM'])
  .setChartType('LineChart')
  .setOptions({
    title: 'Expected Soil Moisture Time Series',
    hAxis: { title: 'Date' },
    vAxis: { title: ' Soil Moisture (%)' },
    lineWidth: 1,
    pointSize: 3,
  });

// Print the time series chart
print(timeSeriesChart);





var selectedPixel = ee.Geometry.Point(82.15609234909594,26.83576065161928); 




var singlePixel = soilMoistureVegetation
  .map(function(image) {
    var valueVH = image.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: selectedPixel,
      scale: 30,
    }).get('VH');
    var valueVV = image.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: selectedPixel,
      scale: 30,
    }).get('VV');
   
    return ee.Feature(null, { 'VH': valueVH, 'VV': valueVV }).set('system:time_start', image.get('system:time_start'));
  });

// Create a time series chart
var timeSeriesChart = ui.Chart.feature.byFeature(singlePixel, 'system:time_start', ['VH', 'VV'])
  .setChartType('LineChart')
  .setOptions({
    title: ' Backscatter Coefficient Time Series',
    hAxis: { title: 'Date' },
    vAxis: { title: 'Amplitude (in dB) ' },
    lineWidth: 1,
    pointSize: 3,
  });

// Print the time series chart
print(timeSeriesChart);



