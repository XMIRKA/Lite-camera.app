# WIUT Hackathon 2026 — Computer Vision Track (VisionForce AI)

## 📌 Описание проекта
Данный репозиторий содержит полное решение для трека Computer Vision:
- **Часть А (Детекция нарушений):** Мультиобъектный трекинг (YOLOv8 + ByteTrack) и детерминированные правила фиксации событий по ТЗ (stopped_vehicle, solid_line_crossing, jaywalking, congestion и др.) с временным сглаживанием без наложений.
- **Часть B (Предугадывание аварий):** Каузальный расчет риска столкновений (Time-to-Collision & CPA Miss-Distance) без заглядывания в будущие кадры.

---

## 🚀 Быстрый старт и запуск

### 1. Установка зависимостей
```bash
pip install -r requirements.txt
```

### 2. Запуск веб-приложения Streamlit (Интерактивная панель)
```bash
streamlit run app.py
```

### 3. Прогон решения по папке с тестовыми видео
```bash
python run_submission.py --videos samples --out predictions.json
```

### 4. Проверка судейским валидатором
```bash
python evaluate.py --pred predictions.json --validate-only
```

---

## 📁 Структура репозитория
```text
├── solution.py          # Официальный модуль интерфейса (detect_events + RiskEstimator)
├── app.py               # Интерактивный Streamlit Dashboard
├── run_submission.py    # Скрипт прогона видео от организаторов
├── evaluate.py          # Валидатор формата и подсчет метрик
├── requirements.txt     # Python зависимости
├── weights/             # Веса нейросетевых моделей (<= 5 GB)
└── samples/             # Папка для тестовых видео .mp4
```
