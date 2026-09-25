#!/usr/bin/env python3
"""
WIUT Hackathon 2026 — Computer Vision Track
Streamlit Interactive Traffic Surveillance & Risk Dashboard (app.py)

Clean separation of concerns:
- AI Logic & Official Submission Interface: imported from solution.py
- Visualization & User Experience: rendered via Streamlit
"""

import os
import cv2
import json
import tempfile
import numpy as np
import pandas as pd
import streamlit as st

# Import the official hackathon module
from solution import detect_events, RiskEstimator, CLASSES

# Page Configuration
st.set_page_config(
    page_title="VisionForce AI — Traffic Analytics & Risk Station",
    page_icon="🚦",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling
st.markdown("""
<style>
    .main {
        background-color: #0b0f19;
    }
    .metric-card {
        background-color: #161e2e;
        border: 1px solid #273549;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
    }
    .metric-value {
        font-size: 24px;
        font-weight: bold;
        color: #06b6d4;
        font-family: monospace;
    }
    .metric-label {
        font-size: 12px;
        color: #94a3b8;
        text-transform: uppercase;
    }
    .stButton>button {
        background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%);
        color: #020617;
        font-weight: bold;
        border: none;
        border-radius: 6px;
    }
</style>
""", unsafe_allow_html=True)


def main():
    st.title("🚦 VisionForce AI — Traffic Event & Collision Risk Station")
    st.caption("WIUT Hackathon 2026 · Official Solution Dashboard & Validation Interface")

    # Sidebar Controls
    with st.sidebar:
        st.header("⚙️ Конфигурация запуска")
        
        uploaded_file = st.file_uploader(
            "Загрузите тестовое видео (.mp4)",
            type=["mp4", "avi", "mov"],
            help="Поддерживаются видеозаписи дорожной камеры в разрешении до 1080p."
        )

        st.subheader("Фильтрация классов ТЗ")
        selected_classes = st.multiselect(
            "Отображаемые события",
            options=CLASSES,
            default=CLASSES[:6]
        )

        st.subheader("Параметры инференса")
        sample_stride = st.slider("Шаг кадров (Frame Stride)", min_value=1, max_value=5, value=2)
        risk_threshold = st.slider("Порог тревоги риска (θ)", min_value=0.1, max_value=0.9, value=0.5, step=0.05)

        run_analysis = st.button("🚀 Запустить полный анализ (Часть A + B)", use_container_width=True)

    # Main Dashboard Logic
    if uploaded_file is not None:
        # Save temp file
        tfile = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        tfile.write(uploaded_file.read())
        video_path = tfile.name

        # Extract video metadata
        cap = cv2.VideoCapture(video_path)
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)
        duration = total_frames / fps if total_frames > 0 else 0.0
        cap.release()

        # Metadata Metrics Banner
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.markdown(f'<div class="metric-card"><div class="metric-label">Разрешение</div><div class="metric-value">{width}x{height}</div></div>', unsafe_allow_html=True)
        with col2:
            st.markdown(f'<div class="metric-card"><div class="metric-label">Частота кадров (FPS)</div><div class="metric-value">{fps:.1f}</div></div>', unsafe_allow_html=True)
        with col3:
            st.markdown(f'<div class="metric-card"><div class="metric-label">Длительность</div><div class="metric-value">{duration:.2f} сек</div></div>', unsafe_allow_html=True)
        with col4:
            st.markdown(f'<div class="metric-card"><div class="metric-label">Всего кадров</div><div class="metric-value">{total_frames}</div></div>', unsafe_allow_html=True)

        # Video Player
        st.video(video_path)

        if run_analysis:
            progress_bar = st.progress(0, text="Анализ дорожных событий (Часть A)...")

            # -----------------------------------------------------------------
            # PART A: RUN detect_events FROM solution.py
            # -----------------------------------------------------------------
            meta = {
                "video_id": uploaded_file.name,
                "fps": fps,
                "width": width,
                "height": height,
                "n_frames": total_frames
            }
            events = detect_events(video_path, meta=meta)
            progress_bar.progress(50, text="Каузальный расчет риска аварии (Часть B)...")

            # -----------------------------------------------------------------
            # PART B: RUN RiskEstimator FROM solution.py
            # -----------------------------------------------------------------
            risk_estimator = RiskEstimator()
            risk_estimator.reset(meta)

            cap = cv2.VideoCapture(video_path)
            risk_curve = []
            frame_idx = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                t_sec = float(frame_idx / fps)
                
                # Step through causal risk estimator
                score = risk_estimator.step(frame, t_sec)
                risk_curve.append({"time_sec": round(t_sec, 2), "risk_score": float(score)})
                frame_idx += 1

            cap.release()
            progress_bar.progress(100, text="Анализ завершен успешно!")

            # -----------------------------------------------------------------
            # RESULTS PRESENTATION
            # -----------------------------------------------------------------
            st.divider()
            st.subheader("📊 Результаты детекции дорожных событий (Часть A)")

            filtered_events = [e for e in events if e[2] in selected_classes] if selected_classes else events

            if filtered_events:
                df_events = pd.DataFrame(filtered_events, columns=["Начало (сек)", "Конец (сек)", "Класс события"])
                df_events["Длительность (сек)"] = (df_events["Конец (сек)"] - df_events["Начало (сек)"]).round(2)
                st.dataframe(df_events, use_container_width=True)
            else:
                st.info("События выбранных классов не зафиксированы на данной видеозаписи.")

            # -----------------------------------------------------------------
            # RISK CURVE CHART (PART B)
            # -----------------------------------------------------------------
            st.subheader("📈 Каузальный график риска ДТП на 5 секунд вперед (Часть B)")
            if risk_curve:
                df_risk = pd.DataFrame(risk_curve)
                df_risk.set_index("time_sec", inplace=True)
                st.line_chart(df_risk["risk_score"], height=260)

                # High risk segments
                high_risks = df_risk[df_risk["risk_score"] >= risk_threshold]
                if not high_risks.empty:
                    st.warning(f"⚠️ Зафиксировано {len(high_risks)} кадров с риском аварии выше порога {risk_threshold}!")

            # -----------------------------------------------------------------
            # SUBMISSION JSON EXPORT (Exact predictions.json format)
            # -----------------------------------------------------------------
            st.divider()
            st.subheader("💾 Экспорт в формате судейского робота (predictions.json)")
            
            submission_data = {
                "team": "VisionForce-WIUT",
                "videos": {
                    uploaded_file.name: {
                        "events": events,
                        "risk": [[r["time_sec"], r["risk_score"]] for r in risk_curve]
                    }
                }
            }

            json_str = json.dumps(submission_data, indent=2, ensure_ascii=False)
            st.download_button(
                label="📥 Скачать predictions.json для отправки",
                data=json_str,
                file_name="predictions.json",
                mime="application/json"
            )

    else:
        st.info("👈 Пожалуйста, загрузите видеофайл в левой боковой панели для запуска системы.")


if __name__ == "__main__":
    main()
