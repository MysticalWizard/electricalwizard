import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { SlashCommand } from '@/types';

interface WeatherData {
  location: {
    name: string;
    region: string;
    country: string;
    localtime: string;
  };
  current: {
    temp_c: number;
    temp_f: number;
    condition: {
      text: string;
      icon: string;
    };
    humidity: number;
    feelslike_c: number;
    feelslike_f: number;
    wind_kph: number;
    wind_mph: number;
    wind_dir: string;
    pressure_mb: number;
    vis_km: number;
    uv: number;
  };
}

interface WttrResponse {
  current_condition: Array<{
    temp_C: string;
    temp_F: string;
    weatherDesc: Array<{ value: string }>;
    weatherIconUrl: Array<{ value: string }>;
    humidity: string;
    FeelsLikeC: string;
    FeelsLikeF: string;
    windspeedKmph: string;
    windspeedMiles: string;
    winddir16Point: string;
    pressure: string;
    visibility: string;
    uvIndex: string;
    localObsDateTime: string;
  }>;
  nearest_area: Array<{
    areaName: Array<{ value: string }>;
    region: Array<{ value: string }>;
    country: Array<{ value: string }>;
  }>;
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get current weather for a location')
    .addStringOption((option) =>
      option
        .setName('location')
        .setDescription(
          'City name, coordinates, or "zip,country" (e.g., "London", "40.7,-74", "10001,US")',
        )
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName('fahrenheit')
        .setDescription('Show temperature in Fahrenheit (default: Celsius)'),
    ) as SlashCommandBuilder,
  global: true,
  cooldown: 10,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const location = interaction.options.getString('location', true);
    const useFahrenheit = interaction.options.getBoolean('fahrenheit') || false;

    await interaction.deferReply();

    try {
      const weatherData = await fetchWeatherData(location);
      const embed = createWeatherEmbed(weatherData, useFahrenheit);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Weather command error:', error);

      let errorMessage =
        'Failed to fetch weather data. Please try again later.';
      if (error instanceof Error) {
        if (error.message.includes('location not found')) {
          errorMessage =
            'Location not found. Please check the spelling or try a different format (e.g., "London", "New York", "Tokyo").';
        } else if (error.message.includes('API')) {
          errorMessage =
            'Weather service is currently unavailable. Please try again later.';
        }
      }

      await interaction.editReply({ content: errorMessage });
    }
  },
};

async function fetchWeatherData(location: string): Promise<WeatherData> {
  // Using wttr.in service which provides free weather data in JSON format
  const encodedLocation = encodeURIComponent(location);
  const url = `https://wttr.in/${encodedLocation}?format=j1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Discord Bot Weather Command',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Location not found');
    }
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = (await response.json()) as WttrResponse;

  // wttr.in has a different format, so we need to transform it
  if (!data.current_condition || !data.nearest_area) {
    throw new Error('Invalid weather data received');
  }

  const current = data.current_condition[0];
  const area = data.nearest_area[0];

  return {
    location: {
      name: area.areaName?.[0]?.value || location,
      region: area.region?.[0]?.value || '',
      country: area.country?.[0]?.value || '',
      localtime:
        data.current_condition[0].localObsDateTime || new Date().toISOString(),
    },
    current: {
      temp_c: parseInt(current.temp_C),
      temp_f: parseInt(current.temp_F),
      condition: {
        text: current.weatherDesc?.[0]?.value || 'Unknown',
        icon: current.weatherIconUrl?.[0]?.value || '',
      },
      humidity: parseInt(current.humidity),
      feelslike_c: parseInt(current.FeelsLikeC),
      feelslike_f: parseInt(current.FeelsLikeF),
      wind_kph: parseFloat(current.windspeedKmph),
      wind_mph: parseFloat(current.windspeedMiles),
      wind_dir: current.winddir16Point || '',
      pressure_mb: parseFloat(current.pressure),
      vis_km: parseFloat(current.visibility),
      uv: parseFloat(current.uvIndex),
    },
  };
}

function createWeatherEmbed(
  weather: WeatherData,
  useFahrenheit: boolean,
): EmbedBuilder {
  const temp = useFahrenheit ? weather.current.temp_f : weather.current.temp_c;
  const feelsLike = useFahrenheit
    ? weather.current.feelslike_f
    : weather.current.feelslike_c;
  const tempUnit = useFahrenheit ? '°F' : '°C';
  const windSpeed = useFahrenheit
    ? weather.current.wind_mph
    : weather.current.wind_kph;
  const windUnit = useFahrenheit ? 'mph' : 'km/h';

  const location = weather.location.region
    ? `${weather.location.name}, ${weather.location.region}, ${weather.location.country}`
    : `${weather.location.name}, ${weather.location.country}`;

  const embed = new EmbedBuilder()
    .setTitle(`🌤️ Weather for ${location}`)
    .setColor(getWeatherColor(weather.current.condition.text))
    .setDescription(weather.current.condition.text)
    .addFields(
      {
        name: '🌡️ Temperature',
        value: `${temp}${tempUnit} (feels like ${feelsLike}${tempUnit})`,
        inline: true,
      },
      {
        name: '💧 Humidity',
        value: `${weather.current.humidity}%`,
        inline: true,
      },
      {
        name: '💨 Wind',
        value: `${windSpeed} ${windUnit} ${weather.current.wind_dir}`,
        inline: true,
      },
      {
        name: '🔽 Pressure',
        value: `${weather.current.pressure_mb} mb`,
        inline: true,
      },
      {
        name: '👁️ Visibility',
        value: `${weather.current.vis_km} km`,
        inline: true,
      },
      {
        name: '☀️ UV Index',
        value: `${weather.current.uv}`,
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter({ text: 'Powered by wttr.in' });

  if (weather.current.condition.icon) {
    embed.setThumbnail(weather.current.condition.icon);
  }

  return embed;
}

function getWeatherColor(condition: string): number {
  const conditionLower = condition.toLowerCase();

  if (conditionLower.includes('sunny') || conditionLower.includes('clear')) {
    return 0xffd700; // Gold
  } else if (conditionLower.includes('cloud')) {
    return 0x87ceeb; // Sky blue
  } else if (
    conditionLower.includes('rain') ||
    conditionLower.includes('drizzle')
  ) {
    return 0x4682b4; // Steel blue
  } else if (
    conditionLower.includes('snow') ||
    conditionLower.includes('blizzard')
  ) {
    return 0xe6e6fa; // Lavender
  } else if (
    conditionLower.includes('storm') ||
    conditionLower.includes('thunder')
  ) {
    return 0x696969; // Dim gray
  } else if (
    conditionLower.includes('fog') ||
    conditionLower.includes('mist')
  ) {
    return 0xd3d3d3; // Light gray
  }

  return 0x87ceeb; // Default sky blue
}

export default command;
