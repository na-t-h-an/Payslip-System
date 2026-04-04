# Stage 1: Build using an existing JDK 25 image
FROM openjdk:25-ea-jdk-slim AS build
WORKDIR /app

# Install Maven manually since there isn't a combined Maven+JDK25 image yet
RUN apt-get update && apt-get install -y maven

# Copy and build
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Run using JRE 25
FROM openjdk:25-ea-jre-slim
WORKDIR /app
COPY --from=build /app/target/payroll-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]