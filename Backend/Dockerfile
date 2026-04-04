# Stage 1: Build Stage
FROM openjdk:25-ea-21-jdk-slim AS build
WORKDIR /app

# Install Maven
RUN apt-get update && apt-get install -y maven

# Copy and build
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Run Stage (Using the same full JDK image to ensure availability)
FROM openjdk:25-ea-21-jdk-slim
WORKDIR /app
COPY --from=build /app/target/payroll-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]