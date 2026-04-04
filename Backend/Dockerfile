# Stage 1: Build using Maven and JDK 25
FROM maven:3.9.9-eclipse-temurin-25-preview AS build
WORKDIR /app
# Copy the pom.xml and source code
COPY pom.xml .
COPY src ./src
# Build the application
RUN mvn clean package -DskipTests

# Stage 2: Run using JRE 25
FROM eclipse-temurin:25-jre-preview
WORKDIR /app
# Copy the JAR from the build stage
# Note: Ensure the JAR name matches your pom.xml artifactId and version
COPY --from=build /app/target/payroll-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]