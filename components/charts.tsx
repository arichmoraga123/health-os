"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const baseOptions = {
  responsive: true,
  plugins: { legend: { labels: { color: "#a0a0b8", font: { family: "IBM Plex Mono", size: 11 } } } },
  scales: {
    x: { ticks: { color: "#4a4a6a" }, grid: { color: "rgba(255,255,255,0.06)" } },
    y: { ticks: { color: "#4a4a6a" }, grid: { color: "rgba(255,255,255,0.06)" } },
  },
};

const horizontalOptions = {
  ...baseOptions,
  indexAxis: "y" as const,
  scales: {
    x: { ticks: { color: "#4a4a6a" }, grid: { color: "rgba(255,255,255,0.06)" } },
    y: { ticks: { color: "#a0a0b8" }, grid: { display: false } },
  },
};

export function LineChart({ data }: { data: any }) {
  return <Line options={baseOptions as any} data={data} />;
}

export function BarChart({ data }: { data: any }) {
  return <Bar options={baseOptions as any} data={data} />;
}

export function DoughnutChart({ data }: { data: any }) {
  return <Doughnut options={{ plugins: { legend: { labels: { color: "#a0a0b8" } } } }} data={data} />;
}

export function HorizontalBarChart({ data }: { data: any }) {
  return <Bar options={horizontalOptions as any} data={data} />;
}
