# 사용할 MySQL 공식 이미지 지정 (8.0 버전 권장)
FROM mysql:8.0

# 환경변수는 .env 파일(docker-compose)을 통해 실행 시 주입받습니다.

# 초기 설정 쉘 스크립트 복사 
# 순수 SQL(init.sql)은 환경변수를 읽지 못하므로, 환경변수를 참조할 수 있는 init.sh 쉘 스크립트를 사용합니다.
COPY ./init.sh /docker-entrypoint-initdb.d/
COPY ./n8n_user.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init.sh /docker-entrypoint-initdb.d/n8n_user.sh

# 컨테이너의 3306 포트를 개방
EXPOSE 3306
