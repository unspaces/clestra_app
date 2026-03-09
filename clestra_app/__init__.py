__version__ = "0.0.1"

# Product Color 자동 생성을 위한 monkey-patch 로드
# Document._validate_links를 패치하여, Link 유효성 검사 전에
# Product Color 미등록 값을 자동 생성합니다.
try:
    import clestra_app.clestra_app.doctype.product_color.product_color  # noqa: F401
except Exception:
    pass
