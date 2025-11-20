const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withMapLibre(config) {
    return withProjectBuildGradle(config, (config) => {
        if (config.modResults.contents.includes('maplibre')) {
            return config;
        }

        config.modResults.contents = config.modResults.contents.replace(
            /allprojects\s*{/,
            `allprojects {
        repositories {
            maven {
                url 'https://api.mapbox.com/downloads/v2/releases/maven'
                authentication {
                    basic(BasicAuthentication)
                }
                credentials {
                    username = 'mapbox'
                    password = project.properties['MAPBOX_DOWNLOADS_TOKEN'] ?: ""
                }
            }
        }`
        );

        return config;
    });
};
